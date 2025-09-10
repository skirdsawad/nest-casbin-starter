
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRule } from '../common/entities/approval-rule.entity';
import { Department } from '../common/entities/department.entity';
import { RoleCode } from '../common/models/domain';

@Injectable()
export class RulesRepository {
  constructor(
    @InjectRepository(ApprovalRule)
    private readonly rulesRepository: Repository<ApprovalRule>,
  ) {}

  findAll(): Promise<ApprovalRule[]> {
    return this.rulesRepository.find();
  }

  findByDepartmentId(departmentId: string): Promise<ApprovalRule[]> {
    return this.rulesRepository.findBy({ departmentId });
  }

  findByDepartmentIdAndStageCode(departmentId: string, stageCode: string): Promise<ApprovalRule | undefined> {
    return this.rulesRepository.findOneBy({ departmentId, stageCode });
  }

  async seed(departments: Department[]) {
    const rulesData: { deptCode: string; stageCode: string; minApprovers: number; fallbackRole: RoleCode | null }[] = [
      { deptCode: 'HR', stageCode: 'DEPT_HEAD', minApprovers: 1, fallbackRole: null },
      { deptCode: 'MKT', stageCode: 'DEPT_HEAD', minApprovers: 1, fallbackRole: null },
      { deptCode: 'IT', stageCode: 'DEPT_HEAD', minApprovers: 1, fallbackRole: 'AMD' },
      { deptCode: 'SP', stageCode: 'DEPT_HEAD', minApprovers: 1, fallbackRole: 'AMD' },
    ];

    for (const ruleData of rulesData) {
      const department = departments.find(d => d.code === ruleData.deptCode);
      if (!department) {
        console.warn(`Department with code ${ruleData.deptCode} not found for seeding rule.`);
        continue;
      }

      const existing = await this.findByDepartmentIdAndStageCode(department.id, ruleData.stageCode);
      if (!existing) {
        await this.rulesRepository.save({
          departmentId: department.id,
          stageCode: ruleData.stageCode,
          minApprovers: ruleData.minApprovers,
          fallbackRole: ruleData.fallbackRole,
        });
      }
    }
  }
}
