import { Module } from '@nestjs/common';
import { CasbinModule } from './common/casbin/casbin.module';
import { RequestsModule } from './requests/requests.module';
import { DepartmentsModule } from './departments/departments.module';
import { RulesModule } from './rules/rules.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuthModule } from './common/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    CasbinModule,
    DepartmentsModule,
    RulesModule,
    ApprovalsModule,
    RequestsModule
  ]
})
export class AppModule {}
