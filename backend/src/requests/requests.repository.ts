import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestEntity } from '../common/entities/request.entity';
import { User } from '../users/user.entity';
import { Department } from '../common/entities/department.entity';

@Injectable()
export class RequestsRepository {
  constructor(
    @InjectRepository(RequestEntity)
    private readonly requestsRepository: Repository<RequestEntity>,
  ) {}

  create(data: Omit<RequestEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<RequestEntity> {
    const request = this.requestsRepository.create(data);
    return this.requestsRepository.save(request);
  }

  async update(id: string, patch: Partial<RequestEntity>): Promise<RequestEntity> {
    await this.requestsRepository.update(id, patch);
    const result = await this.findById(id);
    if (!result) {
      throw new Error('Not Found');
    }
    return result;
  }

  findById(id: string): Promise<RequestEntity | undefined> {
    return this.requestsRepository.findOneBy({ id });
  }

  findByDepartmentId(departmentId: string): Promise<RequestEntity[]> {
    return this.requestsRepository.findBy({ departmentId });
  }

  findInReview(): Promise<RequestEntity[]> {
    return this.requestsRepository.findBy({ status: 'IN_REVIEW' });
  }

  findAll(): Promise<RequestEntity[]> {
    return this.requestsRepository.find();
  }

  async seed(users: User[], departments: Department[]): Promise<RequestEntity[]> {
    const sampleRequests = [
      // 1. DRAFT request from HR
      {
        user: 'hr.user@example.com',
        dept: 'HR',
        status: 'DRAFT' as const,
        stageCode: 'DEPT_HEAD',
        payload: { type: 'Leave Request', description: 'Annual leave for 5 days' }
      },
      // 2. SUBMITTED request from Marketing waiting for HD approval  
      {
        user: 'mkt.user@example.com',
        dept: 'MKT',
        status: 'SUBMITTED' as const,
        stageCode: 'DEPT_HEAD',
        payload: { type: 'Budget Request', description: 'Marketing campaign budget $50,000' }
      },
      // 3. IN_REVIEW request from IT waiting for AF approval
      {
        user: 'it.user@example.com',
        dept: 'IT',
        status: 'IN_REVIEW' as const,
        stageCode: 'AF_REVIEW',
        payload: { type: 'Equipment Purchase', description: 'New servers for data center' }
      },
      // 4. AF department request (should end after HD approval)
      {
        user: 'af.user@example.com',
        dept: 'AF',
        status: 'SUBMITTED' as const,
        stageCode: 'DEPT_HEAD',
        payload: { type: 'Audit Request', description: 'External audit preparation' }
      },
      // 5. APPROVED request from SP
      {
        user: 'sp.user@example.com',
        dept: 'SP',
        status: 'APPROVED' as const,
        stageCode: 'AF_REVIEW',
        payload: { type: 'Strategic Plan', description: 'Q4 strategic planning document' }
      },
      // 6. REJECTED request from HR
      {
        user: 'hr.staff2@example.com',
        dept: 'HR',
        status: 'REJECTED' as const,
        stageCode: 'DEPT_HEAD',
        payload: { type: 'Training Request', description: 'Expensive external training course' }
      }
    ];

    const seededRequests: RequestEntity[] = [];

    for (const reqData of sampleRequests) {
      const user = users.find(u => u.email === reqData.user);
      const dept = departments.find(d => d.code === reqData.dept);
      
      if (!user || !dept) {
        console.warn(`User ${reqData.user} or department ${reqData.dept} not found for request seeding`);
        continue;
      }

      const existing = await this.requestsRepository.findOne({
        where: { 
          createdBy: user.id, 
          departmentId: dept.id,
          payload: reqData.payload 
        }
      });

      if (!existing) {
        const request = await this.requestsRepository.save({
          departmentId: dept.id,
          createdBy: user.id,
          status: reqData.status,
          stageCode: reqData.stageCode,
          payload: reqData.payload
        });
        seededRequests.push(request);
      }
    }

    return seededRequests;
  }
}
