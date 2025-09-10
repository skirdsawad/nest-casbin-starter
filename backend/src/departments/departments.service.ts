import { Injectable } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { Department } from '../common/entities/department.entity';

@Injectable()
export class DepartmentsService {
  constructor(private readonly repository: DepartmentsRepository) {}

  findAll(): Promise<Department[]> {
    return this.repository.findAll();
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
