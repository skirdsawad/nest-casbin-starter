import { Injectable } from '@nestjs/common';
import { Approval } from '../common/models/domain';

@Injectable()
export class ApprovalsRepository {
  private _id = 1;
  private readonly APPRS: Approval[] = [];

  create(a: Omit<Approval, 'id'>): Approval {
    // uniqueness: (requestId, stageCode, approverId)
    if (
      this.APPRS.some(
        (x) =>
          x.requestId === a.requestId &&
          x.stageCode === a.stageCode &&
          x.approverId === a.approverId,
      )
    ) {
      throw new Error('Duplicate approval by same user');
    }
    const rec: Approval = { id: this._id++, ...a };
    this.APPRS.push(rec);
    return rec;
  }

  countDistinctApprovers(
    requestId: number,
    stageCode: string,
    decision: 'approve' | 'reject',
  ): number {
    const set = new Set<string>();
    for (const a of this.APPRS) {
      if (
        a.requestId === requestId &&
        a.stageCode === stageCode &&
        a.decision === decision
      ) {
        set.add(a.approverId);
      }
    }
    return set.size;
  }
}