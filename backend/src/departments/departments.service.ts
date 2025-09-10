import { Injectable } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { Department } from '../common/models/domain';

@Injectable()
export class DepartmentsService {
  constructor(private readonly repository: DepartmentsRepository) {}

  findAll(): Department[] {
    return this.repository.findAll();
  }

  findById(id: number): Department | undefined {
    return this.repository.findById(id);
  }

  findByCode(code: string): Department | undefined {
    return this.repository.findByCode(code);
  }

  getCodeById(id: number): string {
    const d = this.repository.findById(id);
    if (!d) throw new Error(`Department not found: ${id}`);
    return d.code;
  }
}