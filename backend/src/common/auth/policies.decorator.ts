
import { SetMetadata } from '@nestjs/common';

export const CHECK_POLICIES_KEY = 'check_policy';

export const CheckPolicies = (object: string, action: string) =>
  SetMetadata(CHECK_POLICIES_KEY, [object, action]);
