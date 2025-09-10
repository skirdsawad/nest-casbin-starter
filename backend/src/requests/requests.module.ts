
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { DepartmentsModule } from '../departments/departments.module';
import { RulesModule } from '../rules/rules.module';
import { CasbinModule } from '../common/casbin/casbin.module';
import { AuthModule } from '../common/auth/auth.module';
import { RequestsRepository } from './requests.repository';
import { ApprovalsModule } from '../approvals/approvals.module';
import { RequestEntity } from '../common/entities/request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestEntity]),
    DepartmentsModule,
    RulesModule,
    CasbinModule,
    AuthModule,
    forwardRef(() => ApprovalsModule),
  ],
  controllers: [RequestsController],
  providers: [RequestsService, RequestsRepository],
  exports: [RequestsRepository],
})
export class RequestsModule {}
