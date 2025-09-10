import { Inject, Injectable } from '@nestjs/common';
import type { Enforcer } from 'casbin';

@Injectable()
export class CasbinService {
  constructor(@Inject('CASBIN_ENFORCER') private readonly enforcer: Enforcer) {}

  enforce(userId: string, deptCode: string, obj: string, act: string): Promise<boolean> {
    return this.enforcer.enforce(userId, deptCode, obj, act);
  }

  async hasAnyEligible(role: string, deptCode: string, act: string): Promise<boolean> {
    // Check if any user bound to role in domain would be allowed to take action
    const users = await this.enforcer.getUsersForRoleInDomain(role, deptCode);
    for (const u of users) {
      if (await this.enforcer.enforce(u, deptCode, 'requests', act)) return true;
    }
    return false;
  }
}