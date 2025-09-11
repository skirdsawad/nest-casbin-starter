import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApprovalsRepository } from './approvals.repository';
import { RequestsRepository } from '../requests/requests.repository';
import { RulesService } from '../rules/rules.service';
import { DepartmentsService } from '../departments/departments.service';
import { CasbinService } from '../common/casbin/casbin.service';
import { UserContext } from '../common/auth/user-context.service';
import { RequestEntity } from '../common/entities/request.entity';

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

  async determineInitialStage(departmentId: string): Promise<string> {
    const deptCode = await this.depts.getCodeById(departmentId);
    const act = 'approve:DEPT_HEAD';
    const hasHD = await this.policy.hasAnyEligible('HD', deptCode, act);
    if (hasHD) return 'DEPT_HEAD';

    const rule = await this.rules.get(departmentId, 'DEPT_HEAD');
    if (rule?.fallbackRole === 'AMD') return 'AMD_REVIEW';
    return 'DEPT_HEAD';
  }

  async approve(requestId: string, decision: 'approve' | 'reject'): Promise<RequestEntity> {
    const userId = await this.userContext.getUserId();
    const req = await this.requestsRepository.findById(requestId);
    if (!req) throw new NotFoundException('Request not found');

    // Prevent self-approval
    if (req.createdBy === userId) {
      throw new ForbiddenException('You cannot approve your own request.');
    }

    const deptCode = await this.depts.getCodeById(req.departmentId);
    const action = `approve:${req.stageCode}`;
    const ok = await this.policy.enforce(userId, deptCode, 'requests', action);
    if (!ok) throw new ForbiddenException('Not eligible to approve this stage');

    try {
      await this.approvalsRepository.create({
        requestId: req.id,
        approverId: userId,
        stageCode: req.stageCode,
        decision,
      });
    } catch (e: any) {
      if (e.message.includes('Duplicate')) {
        throw new BadRequestException('Duplicate approval by same user');
      }
      throw e;
    }

    if (decision === 'reject') {
      await this.requestsRepository.update(req.id, { status: 'REJECTED' });
      const result = await this.requestsRepository.findById(req.id);
      if (!result) throw new NotFoundException('Request not found');
      return result;
    }

    const rule = (await this.rules.get(req.departmentId, req.stageCode)) || { minApprovers: 1 };
    const count = await this.approvalsRepository.countDistinctApprovers(req.id, req.stageCode, 'approve');
    if (count >= rule.minApprovers) {
      const nextStage = await this.determineNextStage(req.departmentId, req.stageCode);
      if (nextStage) {
        await this.requestsRepository.update(req.id, { stageCode: nextStage });
      } else {
        await this.requestsRepository.update(req.id, { status: 'APPROVED' });
      }
    }
    const result = await this.requestsRepository.findById(req.id);
    if (!result) throw new NotFoundException('Request not found');
    return result;
  }

  private async determineNextStage(departmentId: string, currentStage: string): Promise<string | null> {
    const deptCode = await this.depts.getCodeById(departmentId);
    
    if (currentStage === 'DEPT_HEAD') {
      // AF and CG department requests have 1-step approval (end after HD approval)
      if (deptCode === 'AF' || deptCode === 'CG') {
        return null; // AF and CG requests end after DEPT_HEAD approval
      }
      // All other departments go to AF_REVIEW
      return 'AF_REVIEW';
    }
    
    if (currentStage === 'AF_REVIEW') {
      // After AF_REVIEW, non-AF requests go to CG_REVIEW
      if (deptCode !== 'AF') {
        return 'CG_REVIEW';
      }
      return null;
    }
    
    if (currentStage === 'CG_REVIEW') {
      // After CG_REVIEW, the process is finished
      return null;
    }
    
    return null;
  }
}
