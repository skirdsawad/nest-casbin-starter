import { Enforcer } from 'casbin';
import { User } from '../../users/user.entity';

export async function seedPolicies(enf: Enforcer, users: User[]) {
  const departments = ['HR', 'MKT', 'IT', 'SP', 'AF', 'CG'];
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

  // CG_APPROVER role can approve CG_REVIEW stage for any department
  policies.push(['CG_APPROVER', '*', 'requests', 'approve:CG_REVIEW']);
  
  // CG_APPROVER can view requests at AF_REVIEW stage for early visibility (but cannot approve until CG_REVIEW)
  policies.push(['CG_APPROVER', '*', 'requests', 'view:AF_REVIEW']);

  // Global policies for AMD
  policies.push(['AMD', '*', 'requests', 'approve:AMD_REVIEW']);
  policies.push(['AMD', '*', 'requests', 'approve:DEPT_HEAD']); // AMD can approve DEPT_HEAD as fallback
  policies.push(['AMD', '*', 'requests', 'approve:AF_REVIEW']); // AMD can approve AF_REVIEW as fallback
  policies.push(['AMD', '*', 'requests', 'approve:CG_REVIEW']); // AMD can approve CG_REVIEW as fallback
  policies.push(['AMD', '*', 'requests', 'bulk_approve']); // AMD can bulk approve
  policies.push(['AMD', '*', 'requests', 'view']); // AMD can view all requests

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
    'cg.head@example.com': { role: 'HD', domain: 'CG' },
    // Department Staff
    'hr.user@example.com': { role: 'STAFF', domain: 'HR' },
    'mkt.user@example.com': { role: 'STAFF', domain: 'MKT' },
    'it.user@example.com': { role: 'STAFF', domain: 'IT' },
    'sp.user@example.com': { role: 'STAFF', domain: 'SP' },
    'af.user@example.com': { role: 'STAFF', domain: 'AF' },
    'cg.user@example.com': { role: 'STAFF', domain: 'CG' },
    // Additional staff
    'hr.staff2@example.com': { role: 'STAFF', domain: 'HR' },
    'mkt.staff2@example.com': { role: 'STAFF', domain: 'MKT' },
    // Global Roles
    'amd.user@example.com': { role: 'AMD', domain: '*' },
  };

  // Special roles for AF users (in addition to their primary department roles)
  const afApproverUsers = ['af.user@example.com', 'af.head@example.com'];

  // Special roles for CG users (in addition to their primary department roles)
  const cgApproverUsers = ['cg.user@example.com', 'cg.head@example.com'];

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

  // Assign CG_APPROVER role to CG department users for cross-department approvals
  for (const user of users) {
    if (cgApproverUsers.includes(user.email)) {
      await enf.addRoleForUser(user.id, 'CG_APPROVER', '*');
    }
  }
}
