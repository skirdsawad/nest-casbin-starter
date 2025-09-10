import { Inject, Injectable } from '@nestjs/common';
import type { Enforcer } from 'casbin';

@Injectable()
export class CasbinService {
  constructor(@Inject('CASBIN_ENFORCER') private readonly enforcer: Enforcer) {}

  enforce(userId: string, deptCode: string, obj: string, act: string): Promise<boolean> {
    return this.enforcer.enforce(userId, deptCode, obj, act);
  }

  getRolesForUserInDomain(userId: string, domain: string): Promise<string[]> {
    return this.enforcer.getRolesForUser(userId, domain);
  }

  getUsersForRoleInDomain(role: string, domain: string): Promise<string[]> {
    return this.enforcer.getUsersForRoleInDomain(role, domain);
  }

  async getRolesForUser(userId: string): Promise<[string, string][]> {
    const allGroupingPolicies = await this.enforcer.getGroupingPolicy();
    // gPolicy is [userId, role, domain]
    const userPolicies = allGroupingPolicies.filter(gPolicy => gPolicy[0] === userId);
    // map to [role, domain]
    return userPolicies.map(gPolicy => [gPolicy[1], gPolicy[2]]);
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