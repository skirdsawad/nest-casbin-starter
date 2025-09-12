import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { Department } from '../common/entities/department.entity';
import { CasbinService } from '../common/casbin/casbin.service';
import { UserContext } from '../common/auth/user-context.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { Enforcer } from 'casbin';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly repository: DepartmentsRepository,
    private readonly casbin: CasbinService,
    private readonly userContext: UserContext,
    @Inject('CASBIN_ENFORCER') private readonly enforcer: Enforcer,
  ) {}

  findAll(): Promise<Department[]> {
    return this.repository.findAll();
  }

  async findCreatable(): Promise<Department[]> {
    const userId = await this.userContext.getUserId();
    const allDepts = await this.repository.findAll();
    const creatableDepts: Department[] = [];

    for (const dept of allDepts) {
      const canCreate = await this.casbin.enforce(userId, dept.code, 'requests', 'create');
      if (canCreate) {
        creatableDepts.push(dept);
      }
    }
    return creatableDepts;
  }

  findById(id: string): Promise<Department | undefined> {
    return this.repository.findById(id);
  }

  findByCode(code: string): Promise<Department | undefined> {
    return this.repository.findByCode(code);
  }

  async getCodeById(id: string): Promise<string> {
    const d = await this.repository.findById(id);
    if (!d) throw new Error(`Department not found: ${id}`);
    return d.code;
  }

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    const existingDepartment = await this.repository.findByCode(createDepartmentDto.code);
    if (existingDepartment) {
      throw new ConflictException('Department with this code already exists');
    }

    // Create department entity
    const newDepartment = await this.repository.create({
      code: createDepartmentDto.code,
      name: createDepartmentDto.name,
    });

    // Automatically create Casbin policies for the new department
    await this.createDepartmentPolicies(createDepartmentDto.code);

    return newDepartment;
  }

  private async createDepartmentPolicies(departmentCode: string): Promise<void> {
    const policies = [
      // HD permissions for this department
      ['HD', departmentCode, 'requests', 'view'],
      ['HD', departmentCode, 'requests', 'create'],
      ['HD', departmentCode, 'requests', 'edit'],
      ['HD', departmentCode, 'requests', 'approve:DEPT_HEAD'],
      
      // STAFF permissions for this department
      ['STAFF', departmentCode, 'requests', 'view'],
      ['STAFF', departmentCode, 'requests', 'create'],
      ['STAFF', departmentCode, 'requests', 'edit'],
    ];

    // Add all policies to Casbin
    for (const policy of policies) {
      await this.enforcer.addPolicy(...policy);
    }

    // Save policies to database
    await this.enforcer.savePolicy();
  }
}
