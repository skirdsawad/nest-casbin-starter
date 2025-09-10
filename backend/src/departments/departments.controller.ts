import { Controller, Get, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { Department } from '../common/entities/department.entity';
import { PoliciesGuard } from '../common/auth/policies.guard';

@Controller('departments')
@UseGuards(PoliciesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(): Promise<Department[]> {
    return this.departmentsService.findAll();
  }

  @Get('creatable')
  findCreatable(): Promise<Department[]> {
    return this.departmentsService.findCreatable();
  }
}
