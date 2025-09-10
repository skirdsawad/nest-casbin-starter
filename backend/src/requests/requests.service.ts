
import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestsRepository } from './requests.repository';
import { ApprovalsService } from '../approvals/approvals.service';
import { UserContext } from '../common/auth/user-context.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestEntity } from '../common/models/domain';

@Injectable()
export class RequestsService {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly repository: RequestsRepository,
    private readonly userContext: UserContext,
  ) {}

  async list(departmentId: number): Promise<RequestEntity[]> {
    return this.repository.findByDepartmentId(departmentId);
  }

  async create(createRequestDto: CreateRequestDto): Promise<RequestEntity> {
    const userId = this.userContext.userId;
    const { departmentId, payload } = createRequestDto;

    const initialStage = await this.approvals.determineInitialStage(departmentId);
    return this.repository.create({
      departmentId,
      createdBy: userId,
      payload,
      status: 'DRAFT',
      stageCode: initialStage,
    });
  }

  async findById(id: number): Promise<RequestEntity> {
    const request = this.repository.findById(id);
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async submit(id: number): Promise<RequestEntity> {
    const r = this.repository.findById(id);
    if (!r) throw new NotFoundException('Request not found');
    return this.repository.update(id, { status: 'IN_REVIEW' });
  }

  async approve(id: number, decision: 'approve' | 'reject'): Promise<RequestEntity> {
    return this.approvals.approve(id, decision);
  }

  async bulk(ids: number[], action: 'approve' | 'reject'): Promise<RequestEntity[]> {
    const out: RequestEntity[] = [];
    for (const id of ids) {
      out.push(await this.approvals.approve(id, action));
    }
    return out;
  }
}
