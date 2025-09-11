import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CasbinModule } from '../common/casbin/casbin.module';
import { DepartmentsModule } from '../departments/departments.module';
import { DepartmentsRepository } from '../departments/departments.repository';
import { Department } from '../common/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Department]),
    CasbinModule,
    forwardRef(() => DepartmentsModule),
  ],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService, DepartmentsRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}