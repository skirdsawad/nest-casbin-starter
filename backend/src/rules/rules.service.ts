import { Injectable } from '@nestjs/common';
import { RulesRepository } from './rules.repository';
import { ApprovalRule } from '../common/entities/approval-rule.entity';

@Injectable()
export class RulesService {
  constructor(private readonly repository: RulesRepository) {}

  findAll(): Promise<ApprovalRule[]> {
    return this.repository.findAll();
  }

  findByDepartmentId(departmentId: string): Promise<ApprovalRule[]> {
    return this.repository.findByDepartmentId(departmentId);
  }

  get(departmentId: string, stageCode: string): Promise<ApprovalRule | undefined> {
    return this.repository.findByDepartmentIdAndStageCode(departmentId, stageCode);
  }
}
