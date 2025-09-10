import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentsService } from './departments.service';
import { DepartmentsRepository } from './departments.repository';
import { Department } from '../common/entities/department.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Department])],
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
