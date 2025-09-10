
import { Injectable } from '@nestjs/common';
import { ApprovalRule } from '../common/models/domain';

const RULES: ApprovalRule[] = [
  { id: 1, departmentId: 15, stageCode: 'DEPT_HEAD', minApprovers: 2, fallbackRole: null },
  { id: 2, departmentId: 19, stageCode: 'DEPT_HEAD', minApprovers: 1, fallbackRole: 'AMD' },
];

@Injectable()
export class RulesRepository {
  findAll(): ApprovalRule[] {
    return RULES;
  }

  findByDepartmentId(departmentId: number): ApprovalRule[] {
    return RULES.filter((r) => r.departmentId === departmentId);
  }

  findByDepartmentIdAndStageCode(departmentId: number, stageCode: string): ApprovalRule | undefined {
    return RULES.find((r) => r.departmentId === departmentId && r.stageCode === stageCode);
  }
}
