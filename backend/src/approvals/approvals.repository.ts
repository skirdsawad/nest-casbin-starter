import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval } from '../common/entities/approval.entity';
import { RequestEntity } from '../common/entities/request.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ApprovalsRepository {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalsRepository: Repository<Approval>,
  ) {}

  async create(a: Omit<Approval, 'id' | 'decidedAt'>): Promise<Approval> {
    // uniqueness: (requestId, stageCode, approverId)
    const existing = await this.approvalsRepository.findOneBy({
      requestId: a.requestId,
      stageCode: a.stageCode,
      approverId: a.approverId,
    });

    if (existing) {
      throw new Error('Duplicate approval by same user');
    }

    const approval = this.approvalsRepository.create(a);
    return this.approvalsRepository.save(approval);
  }

  countDistinctApprovers(
    requestId: string,
    stageCode: string,
    decision: 'approve' | 'reject',
  ): Promise<number> {
    return this.approvalsRepository.count({
      where: {
        requestId,
        stageCode,
        decision,
      },
    });
  }

  async seed(requests: RequestEntity[], users: User[]): Promise<Approval[]> {
    const sampleApprovals = [
      // IT request already approved by IT Head, now waiting for AF approval
      {
        requestPayload: { type: 'Equipment Purchase', description: 'New servers for data center' },
        approverEmail: 'it.head@example.com',
        stageCode: 'DEPT_HEAD',
        decision: 'approve' as const
      },
      // SP request approved by SP Head and AF
      {
        requestPayload: { type: 'Strategic Plan', description: 'Q4 strategic planning document' },
        approverEmail: 'sp.head@example.com',
        stageCode: 'DEPT_HEAD', 
        decision: 'approve' as const
      },
      {
        requestPayload: { type: 'Strategic Plan', description: 'Q4 strategic planning document' },
        approverEmail: 'af.user@example.com',
        stageCode: 'AF_REVIEW',
        decision: 'approve' as const
      },
      // HR request rejected by HR Head
      {
        requestPayload: { type: 'Training Request', description: 'Expensive external training course' },
        approverEmail: 'hr.head@example.com',
        stageCode: 'DEPT_HEAD',
        decision: 'reject' as const
      }
    ];

    const seededApprovals: Approval[] = [];

    for (const approvalData of sampleApprovals) {
      const request = requests.find(r => 
        r.payload.type === approvalData.requestPayload.type && 
        r.payload.description === approvalData.requestPayload.description
      );
      const approver = users.find(u => u.email === approvalData.approverEmail);

      if (!request || !approver) {
        console.warn(`Request or approver not found for approval seeding: ${approvalData.requestPayload.type}`);
        continue;
      }

      const existing = await this.approvalsRepository.findOneBy({
        requestId: request.id,
        stageCode: approvalData.stageCode,
        approverId: approver.id
      });

      if (!existing) {
        const approval = await this.approvalsRepository.save({
          requestId: request.id,
          approverId: approver.id,
          stageCode: approvalData.stageCode,
          decision: approvalData.decision
        });
        seededApprovals.push(approval);
      }
    }

    return seededApprovals;
  }
}
