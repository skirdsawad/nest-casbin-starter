import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentsService } from './departments.service';
import { DepartmentsRepository } from './departments.repository';
import { Department } from '../common/entities/department.entity';
import { DepartmentsController } from './departments.controller';
import { CasbinModule } from '../common/casbin/casbin.module';
import { AuthModule } from '../common/auth/auth.module';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department]),
    CasbinModule,
    forwardRef(() => AuthModule),
    forwardRef(() => RequestsModule),
  ],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
