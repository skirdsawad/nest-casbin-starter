import { Enforcer } from 'casbin';
import { User } from '../../users/user.entity';

export async function seedPolicies(enf: Enforcer, users: User[]) {
  const policies = [
    // AF can view, create, edit requests in any department
    ['AF', '*', 'requests', 'view'],
    ['AF', '*', 'requests', 'create'],
    ['AF', '*', 'requests', 'edit'],

    // CG can view, bulk_approve, and approve specific stages in any department
    ['CG', '*', 'requests', 'view'],
    ['CG', '*', 'requests', 'bulk_approve'],
    ['CG', '*', 'requests', 'approve:DEPT_HEAD'],
    ['CG', '*', 'requests', 'approve:AMD_REVIEW'],

    // HD in D15 can view, create, edit, and approve DEPT_HEAD stage
    ['HD', 'D15', 'requests', 'view'],
    ['HD', 'D15', 'requests', 'create'],
    ['HD', 'D15', 'requests', 'edit'],
    ['HD', 'D15', 'requests', 'approve:DEPT_HEAD'],

    // AMD can approve AMD_REVIEW stage in any department
    ['AMD', '*', 'requests', 'approve:AMD_REVIEW'],
  ];

  for (const p of policies) {
    await enf.addPolicy(...p);
  }

  const userRoles = {
    'user_hd_a@example.com': { role: 'HD', domain: 'D15' },
    'user_hd_b@example.com': { role: 'HD', domain: 'D15' },
    'user_amd_1@example.com': { role: 'AMD', domain: '*' },
    'user_af_1@example.com': { role: 'AF', domain: '*' },
    'user_cg_1@example.com': { role: 'CG', domain: '*' },
  };

  for (const user of users) {
    const roleInfo = userRoles[user.email];
    if (roleInfo) {
      await enf.addRoleForUserInDomain(user.id, roleInfo.role, roleInfo.domain);
    }
  }
}
