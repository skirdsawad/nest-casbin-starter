import { Enforcer } from 'casbin';
import { User } from '../../users/user.entity';

export async function seedPolicies(enf: Enforcer, users: User[]) {
  const departments = ['HR', 'MKT', 'IT', 'SP', 'AF'];
  const policies = [];

  // Add policies for each department for HD and STAFF roles
  for (const dept of departments) {
    // HD permissions
    policies.push(['HD', dept, 'requests', 'view']);
    policies.push(['HD', dept, 'requests', 'create']);
    policies.push(['HD', dept, 'requests', 'edit']);
    policies.push(['HD', dept, 'requests', 'approve:DEPT_HEAD']);
    // STAFF permissions
    policies.push(['STAFF', dept, 'requests', 'view']);
    policies.push(['STAFF', dept, 'requests', 'create']);
    policies.push(['STAFF', dept, 'requests', 'edit']);
  }

  // AF_APPROVER role can approve AF_REVIEW stage for any department
  policies.push(['AF_APPROVER', '*', 'requests', 'approve:AF_REVIEW']);

  // Global policies for CG and AMD
  policies.push(['CG', '*', 'requests', 'view']);
  policies.push(['CG', '*', 'requests', 'bulk_approve']);
  policies.push(['CG', '*', 'requests', 'approve:DEPT_HEAD']);
  policies.push(['CG', '*', 'requests', 'approve:AMD_REVIEW']);
  policies.push(['AMD', '*', 'requests', 'approve:AMD_REVIEW']);
  policies.push(['AMD', '*', 'requests', 'approve:DEPT_HEAD']); // AMD can approve DEPT_HEAD as fallback

  for (const p of policies) {
    await enf.addPolicy(...p);
  }

  const userRoles = {
    // Department Heads
    'hr.head@example.com': { role: 'HD', domain: 'HR' },
    'mkt.head@example.com': { role: 'HD', domain: 'MKT' },
    'it.head@example.com': { role: 'HD', domain: 'IT' },
    'sp.head@example.com': { role: 'HD', domain: 'SP' },
    'af.head@example.com': { role: 'HD', domain: 'AF' },
    // Department Staff
    'hr.user@example.com': { role: 'STAFF', domain: 'HR' },
    'mkt.user@example.com': { role: 'STAFF', domain: 'MKT' },
    'it.user@example.com': { role: 'STAFF', domain: 'IT' },
    'sp.user@example.com': { role: 'STAFF', domain: 'SP' },
    'af.user@example.com': { role: 'STAFF', domain: 'AF' },
    // Additional staff
    'hr.staff2@example.com': { role: 'STAFF', domain: 'HR' },
    'mkt.staff2@example.com': { role: 'STAFF', domain: 'MKT' },
    // Global Roles
    'amd.user@example.com': { role: 'AMD', domain: '*' },
    'cg.user@example.com': { role: 'CG', domain: '*' },
  };

  // Special roles for AF users (in addition to their primary department roles)
  const afApproverUsers = ['af.user@example.com', 'af.head@example.com'];

  // Assign primary roles
  for (const user of users) {
    const roleInfo = userRoles[user.email];
    if (roleInfo) {
      await enf.addRoleForUser(user.id, roleInfo.role, roleInfo.domain);
    }
  }

  // Assign AF_APPROVER role to AF department users for cross-department approvals
  for (const user of users) {
    if (afApproverUsers.includes(user.email)) {
      await enf.addRoleForUser(user.id, 'AF_APPROVER', '*');
    }
  }
}
