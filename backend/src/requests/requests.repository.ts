import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestEntity } from '../common/entities/request.entity';

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

  async update(id: number, patch: Partial<RequestEntity>): Promise<RequestEntity> {
    await this.requestsRepository.update(id, patch);
    const result = await this.findById(id);
    if (!result) {
      throw new Error('Not Found');
    }
    return result;
  }

  findById(id: number): Promise<RequestEntity | undefined> {
    return this.requestsRepository.findOneBy({ id });
  }

  findByDepartmentId(deptId: number): Promise<RequestEntity[]> {
    return this.requestsRepository.findBy({ departmentId: deptId });
  }

  findAll(): Promise<RequestEntity[]> {
    return this.requestsRepository.find();
  }
}
