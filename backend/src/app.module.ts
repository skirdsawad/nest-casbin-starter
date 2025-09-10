import { Module } from '@nestjs/common';
import { CasbinModule } from './common/casbin/casbin.module';
import { RequestsModule } from './requests/requests.module';
import { DepartmentsModule } from './departments/departments.module';
import { RulesModule } from './rules/rules.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuthModule } from './common/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: 'postgresql://localhost:5432/nest-casbin-poc',
      autoLoadEntities: true,
      synchronize: true, // shouldn't be used in production
    }),
    AuthModule,
    CasbinModule,
    DepartmentsModule,
    RulesModule,
    ApprovalsModule,
    RequestsModule,
    UsersModule,
  ],
})
export class AppModule {}
