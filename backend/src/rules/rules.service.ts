import { Injectable } from '@nestjs/common';
import { RulesRepository } from './rules.repository';
import { ApprovalRule } from '../common/models/domain';

@Injectable()
export class RulesService {
  constructor(private readonly repository: RulesRepository) {}

  findAll(): ApprovalRule[] {
    return this.repository.findAll();
  }

  findByDepartmentId(departmentId: number): ApprovalRule[] {
    return this.repository.findByDepartmentId(departmentId);
  }

  get(departmentId: number, stageCode: string): ApprovalRule | undefined {
    return this.repository.findByDepartmentIdAndStageCode(departmentId, stageCode);
  }
}