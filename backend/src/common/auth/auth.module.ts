import { Module, forwardRef } from '@nestjs/common';
import { UserContext } from './user-context.service';
import { PoliciesGuard } from './policies.guard';
import { DepartmentsModule } from '../../departments/departments.module';
import { RequestsModule } from '../../requests/requests.module';

@Module({
  imports: [DepartmentsModule, forwardRef(() => RequestsModule)],
  providers: [UserContext, PoliciesGuard],
  exports: [UserContext, PoliciesGuard],
})
export class AuthModule {}