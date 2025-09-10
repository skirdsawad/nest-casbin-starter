
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsService } from './approvals.service';
import { RulesModule } from '../rules/rules.module';
import { DepartmentsModule } from '../departments/departments.module';
import { CasbinModule } from '../common/casbin/casbin.module';
import { ApprovalsRepository } from './approvals.repository';
import { RequestsModule } from '../requests/requests.module';
import { AuthModule } from '../common/auth/auth.module';
import { Approval } from '../common/entities/approval.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Approval]),
    RulesModule,
    DepartmentsModule,
    CasbinModule,
    forwardRef(() => RequestsModule),
    AuthModule,
  ],
  providers: [ApprovalsService, ApprovalsRepository],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
