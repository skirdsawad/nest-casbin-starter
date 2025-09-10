import { Module, forwardRef } from '@nestjs/common';
import { UserContext } from './user-context.service';
import { PoliciesGuard } from './policies.guard';
import { DepartmentsModule } from '../../departments/departments.module';
import { RequestsModule } from '../../requests/requests.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [UsersModule, forwardRef(() => DepartmentsModule), forwardRef(() => RequestsModule)],
  providers: [UserContext, PoliciesGuard],
  exports: [UserContext, PoliciesGuard],
})
export class AuthModule {}
