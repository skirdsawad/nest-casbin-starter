import { Enforcer } from 'casbin';
import { User } from '../../users/user.entity';

export async function seedPolicies(enf: Enforcer, users: User[]) {
  const departments = ['HR', 'MKT', 'IT', 'SP'];
  const policies = [];

  // Add policies for each department for HD and AF roles
  for (const dept of departments) {
    // HD permissions
    policies.push(['HD', dept, 'requests', 'view']);
    policies.push(['HD', dept, 'requests', 'create']);
    policies.push(['HD', dept, 'requests', 'edit']);
    policies.push(['HD', dept, 'requests', 'approve:DEPT_HEAD']);
    // AF permissions
    policies.push(['AF', dept, 'requests', 'view']);
    policies.push(['AF', dept, 'requests', 'create']);
    policies.push(['AF', dept, 'requests', 'edit']);
  }

  // Global policies for CG and AMD
  policies.push(['CG', '*', 'requests', 'view']);
  policies.push(['CG', '*', 'requests', 'bulk_approve']);
  policies.push(['CG', '*', 'requests', 'approve:DEPT_HEAD']);
  policies.push(['CG', '*', 'requests', 'approve:AMD_REVIEW']);
  policies.push(['AMD', '*', 'requests', 'approve:AMD_REVIEW']);

  for (const p of policies) {
    await enf.addPolicy(...p);
  }

  const userRoles = {
    // Department Heads
    'hr.head@example.com': { role: 'HD', domain: 'HR' },
    'mkt.head@example.com': { role: 'HD', domain: 'MKT' },
    'it.head@example.com': { role: 'HD', domain: 'IT' },
    'sp.head@example.com': { role: 'HD', domain: 'SP' },
    // Department Staff
    'hr.user@example.com': { role: 'AF', domain: 'HR' },
    'mkt.user@example.com': { role: 'AF', domain: 'MKT' },
    'it.user@example.com': { role: 'AF', domain: 'IT' },
    // Global Roles
    'amd.user@example.com': { role: 'AMD', domain: '*' },
    'cg.user@example.com': { role: 'CG', domain: '*' },
  };

  for (const user of users) {
    const roleInfo = userRoles[user.email];
    if (roleInfo) {
      await enf.addRoleForUser(user.id, roleInfo.role, roleInfo.domain);
    }
  }
}
