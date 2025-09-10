import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval } from '../common/entities/approval.entity';

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
    requestId: number,
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
}
