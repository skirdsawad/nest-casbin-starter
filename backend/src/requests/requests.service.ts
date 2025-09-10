
import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestsRepository } from './requests.repository';
import { ApprovalsService } from '../approvals/approvals.service';
import { UserContext } from '../common/auth/user-context.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestEntity } from '../common/entities/request.entity';
import { CasbinService } from '../common/casbin/casbin.service';
import { DepartmentsService } from '../departments/departments.service';
import { RequestWithActionsDto } from './dto/request-with-actions.dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly repository: RequestsRepository,
    private readonly userContext: UserContext,
    private readonly casbin: CasbinService,
    private readonly depts: DepartmentsService,
  ) {}

  async list(departmentId: string): Promise<RequestWithActionsDto[]> {
    const userId = await this.userContext.getUserId();
    const requests = await this.repository.findByDepartmentId(departmentId);
    const deptCode = await this.depts.getCodeById(departmentId);

    return Promise.all(
      requests.map(async (req) => {
        const permittedActions: string[] = [];
        if (req.status === 'DRAFT') {
          if (await this.casbin.enforce(userId, deptCode, 'requests', 'edit')) {
            permittedActions.push('submit');
          }
        }
        if (req.status === 'IN_REVIEW') {
          const action = `approve:${req.stageCode}`;
          if (await this.casbin.enforce(userId, deptCode, 'requests', action)) {
            permittedActions.push('approve', 'reject');
          }
        }
        return { ...req, permittedActions };
      }),
    );
  }

  async findReviewable(): Promise<RequestWithActionsDto[]> {
    const userId = await this.userContext.getUserId();
    const requests = await this.repository.findInReview();
    const allDepts = await this.depts.findAll();
    const deptCodeMap = new Map(allDepts.map((d) => [d.id, d.code]));

    const reviewableRequests: RequestWithActionsDto[] = [];

    for (const req of requests) {
      const deptCode = deptCodeMap.get(req.departmentId);
      if (!deptCode) continue;

      const action = `approve:${req.stageCode}`;
      const canApproveDept = await this.casbin.enforce(userId, deptCode, 'requests', action);
      const canApproveGlobal = await this.casbin.enforce(userId, '*', 'requests', action);

      if (canApproveDept || canApproveGlobal) {
        reviewableRequests.push({
          ...req,
          permittedActions: ['approve', 'reject'],
        });
      }
    }
    return reviewableRequests;
  }

  async create(createRequestDto: CreateRequestDto): Promise<RequestEntity> {
    const userId = await this.userContext.getUserId();
    const { departmentId, payload } = createRequestDto;
    const deptCode = await this.depts.getCodeById(departmentId);

    // Check if the creator is an HD
    const userRoles = await this.casbin.getRolesForUserInDomain(userId, deptCode);
    const isHD = userRoles.includes('HD');

    let initialStage = 'DEPT_HEAD';

    // If the creator is an HD, check if there are other HDs
    if (isHD) {
      const hdUsersInDept = await this.casbin.getUsersForRoleInDomain('HD', deptCode);
      if (hdUsersInDept.length <= 1) {
        // If they are the only HD, bypass DEPT_HEAD stage
        initialStage = 'AF_REVIEW';
      }
    }

    return this.repository.create({
      departmentId,
      createdBy: userId,
      payload,
      status: 'DRAFT',
      stageCode: initialStage,
    } as RequestEntity);
  }

  async findById(id: string): Promise<RequestEntity> {
    const request = await this.repository.findById(id);
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async submit(id: string): Promise<RequestEntity> {
    const r = await this.repository.findById(id);
    if (!r) throw new NotFoundException('Request not found');
    return this.repository.update(id, { status: 'IN_REVIEW' });
  }

  async approve(id: string, decision: 'approve' | 'reject'): Promise<RequestEntity> {
    return this.approvals.approve(id, decision);
  }

  async bulk(ids: string[], action: 'approve' | 'reject'): Promise<RequestEntity[]> {
    const out: RequestEntity[] = [];
    for (const id of ids) {
      out.push(await this.approvals.approve(id, action));
    }
    return out;
  }
}
