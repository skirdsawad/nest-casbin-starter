import { Module } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { DepartmentsRepository } from './departments.repository';

@Module({
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}