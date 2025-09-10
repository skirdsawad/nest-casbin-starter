import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasbinModule } from './common/casbin/casbin.module';
import { RequestsModule } from './requests/requests.module';
import { DepartmentsModule } from './departments/departments.module';
import { RulesModule } from './rules/rules.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuthModule } from './common/auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true, // shouldn't be used in production
      }),
      inject: [ConfigService],
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
