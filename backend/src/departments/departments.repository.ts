
import { Injectable } from '@nestjs/common';
import { Department } from '../common/models/domain';

const DEPARTMENTS: Department[] = [
  { id: 15, code: 'D15', name: 'Department 15' },
  { id: 19, code: 'D19', name: 'Department 19' },
];

@Injectable()
export class DepartmentsRepository {
  findAll(): Department[] {
    return DEPARTMENTS;
  }

  findById(id: number): Department | undefined {
    return DEPARTMENTS.find((d) => d.id === id);
  }

  findByCode(code: string): Department | undefined {
    return DEPARTMENTS.find((d) => d.code === code);
  }
}
