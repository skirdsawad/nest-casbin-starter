import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApprovalsRepository } from './approvals.repository';
import { RequestsRepository } from '../requests/requests.repository';
import { RulesService } from '../rules/rules.service';
import { DepartmentsService } from '../departments/departments.service';
import { CasbinService } from '../common/casbin/casbin.service';
import { UserContext } from '../common/auth/user-context.service';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly rules: RulesService,
    private readonly depts: DepartmentsService,
    private readonly policy: CasbinService,
    private readonly requestsRepository: RequestsRepository,
    private readonly approvalsRepository: ApprovalsRepository,
    private readonly userContext: UserContext,
  ) {}

  async determineInitialStage(departmentId: number): Promise<string> {
    const deptCode = this.depts.getCodeById(departmentId);
    const act = 'approve:DEPT_HEAD';
    const hasHD = await this.policy.hasAnyEligible('HD', deptCode, act);
    if (hasHD) return 'DEPT_HEAD';

    const rule = this.rules.get(departmentId, 'DEPT_HEAD');
    if (rule?.fallbackRole === 'AMD') return 'AMD_REVIEW';
    return 'DEPT_HEAD';
  }

  async approve(requestId: number, decision: 'approve' | 'reject') {
    const userId = this.userContext.userId;
    const req = this.requestsRepository.findById(requestId);
    if (!req) throw new NotFoundException('Request not found');

    const deptCode = this.depts.getCodeById(req.departmentId);
    const action = `approve:${req.stageCode}`;
    const ok = await this.policy.enforce(userId, deptCode, 'requests', action);
    if (!ok) throw new ForbiddenException('Not eligible to approve this stage');

    try {
      this.approvalsRepository.create({
        requestId: req.id,
        approverId: userId,
        stageCode: req.stageCode,
        decision,
        decidedAt: new Date(),
      });
    } catch (e: any) {
      if (e.message.includes('Duplicate')) {
        throw new BadRequestException('Duplicate approval by same user');
      }
      throw e;
    }

    if (decision === 'reject') {
      this.requestsRepository.update(req.id, { status: 'REJECTED' });
      return this.requestsRepository.findById(req.id);
    }

    const rule = this.rules.get(req.departmentId, req.stageCode) || { minApprovers: 1 };
    const count = this.approvalsRepository.countDistinctApprovers(req.id, req.stageCode, 'approve');
    if (count >= rule.minApprovers) {
      this.requestsRepository.update(req.id, { status: 'APPROVED' });
    }
    return this.requestsRepository.findById(req.id);
  }
}