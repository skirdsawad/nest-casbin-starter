import { Injectable } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { Department } from '../common/entities/department.entity';
import { CasbinService } from '../common/casbin/casbin.service';
import { UserContext } from '../common/auth/user-context.service';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly repository: DepartmentsRepository,
    private readonly casbin: CasbinService,
    private readonly userContext: UserContext,
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
}
