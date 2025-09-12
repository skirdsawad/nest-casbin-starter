import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { Department } from '../common/entities/department.entity';
import { PoliciesGuard } from '../common/auth/policies.guard';
import { CreateDepartmentDto } from './dto/create-department.dto';

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

  @Post()
  create(@Body() createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    return this.departmentsService.create(createDepartmentDto);
  }
}
