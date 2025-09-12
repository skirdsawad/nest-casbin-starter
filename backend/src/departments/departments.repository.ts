
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../common/entities/department.entity';

@Injectable()
export class DepartmentsRepository {
  constructor(
    @InjectRepository(Department)
    private readonly departmentsRepository: Repository<Department>,
  ) {}

  findAll(): Promise<Department[]> {
    return this.departmentsRepository.find();
  }

  findById(id: string): Promise<Department | undefined> {
    return this.departmentsRepository.findOneBy({ id });
  }

  findByCode(code: string): Promise<Department | undefined> {
    return this.departmentsRepository.findOneBy({ code });
  }

  create(departmentData: { code: string; name: string }): Promise<Department> {
    return this.departmentsRepository.save(departmentData);
  }

  async seed(): Promise<Department[]> {
    const departmentsData = [
      { code: 'HR', name: 'Human Resources' },
      { code: 'MKT', name: 'Marketing' },
      { code: 'IT', name: 'IT' },
      { code: 'SP', name: 'Strategic&Planning' },
      { code: 'AF', name: 'Accounting&Financial' },
      { code: 'CG', name: 'Corporate Strategy' },
    ];

    const seededDepts: Department[] = [];

    for (const deptData of departmentsData) {
      let dept = await this.findByCode(deptData.code);
      if (!dept) {
        dept = await this.departmentsRepository.save(deptData);
      }
      seededDepts.push(dept);
    }
    return seededDepts;
  }
}
