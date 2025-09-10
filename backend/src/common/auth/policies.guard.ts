import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CasbinService } from '../casbin/casbin.service';
import { UserContext } from './user-context.service';
import { DepartmentsService } from '../../departments/departments.service';
import { CHECK_POLICIES_KEY } from './policies.decorator';
import { Request } from 'express';
import { RequestsRepository } from '../../requests/requests.repository';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly casbinService: CasbinService,
    private readonly userContext: UserContext,
    private readonly departmentsService: DepartmentsService,
    private readonly requestsRepository: RequestsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<[string, string]>(CHECK_POLICIES_KEY, context.getHandler());
    if (!policy) {
      return true;
    }

    const [object, action] = policy;
    const request = context.switchToHttp().getRequest<Request>();
    const userId = await this.userContext.getUserId();

    // Handle global actions that don't have a departmentId
    if (action === 'bulk_approve' || request.url.endsWith('/reviewable')) {
      const hasPermission = await this.casbinService.enforce(userId, '*', object, action);
      if (!hasPermission) {
        // For reviewable, we don't throw an error, just return false
        if (request.url.endsWith('/reviewable')) return true;
        throw new ForbiddenException('You do not have permission to perform this action.');
      }
      return true;
    }

    const departmentId = await this.getDepartmentId(request);
    if (departmentId === null) {
      throw new ForbiddenException('Department ID not found in request');
    }

    const departmentCode = await this.departmentsService.getCodeById(departmentId);

    const hasPermission = await this.casbinService.enforce(userId, departmentCode, object, action);

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    return true;
  }

  private async getDepartmentId(request: Request): Promise<string | null> {
    if (request.params.id) {
      const requestEntity = await this.requestsRepository.findById(request.params.id);
      return requestEntity ? requestEntity.departmentId : null;
    }
    if (request.query.departmentId) {
      return request.query.departmentId as string;
    }
    if (request.body.departmentId) {
      return request.body.departmentId;
    }
    return null;
  }
}
