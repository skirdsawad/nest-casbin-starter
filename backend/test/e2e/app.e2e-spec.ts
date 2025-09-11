import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DepartmentsRepository } from '../../src/departments/departments.repository';
import { UsersRepository } from '../../src/users/users.repository';
import { RulesRepository } from '../../src/rules/rules.repository';
import { Department } from '../../src/common/entities/department.entity';
import { Enforcer } from 'casbin';
import { seedPolicies } from '../../src/common/casbin/policy.seed';

describe('E2E - API Tests', () => {
  let app: INestApplication;
  let departments: Department[];

  // Test users
  const hrHead = { 'x-user-email': 'hr.head@example.com' };
  const mktHead = { 'x-user-email': 'mkt.head@example.com' };
  const itHead = { 'x-user-email': 'it.head@example.com' };
  const afHead = { 'x-user-email': 'af.head@example.com' };
  const cgHead = { 'x-user-email': 'cg.head@example.com' };
  const hrUser = { 'x-user-email': 'hr.user@example.com' };
  const mktUser = { 'x-user-email': 'mkt.user@example.com' };
  const itUser = { 'x-user-email': 'it.user@example.com' };
  const afUser = { 'x-user-email': 'af.user@example.com' };
  const cgUser = { 'x-user-email': 'cg.user@example.com' };
  const amdUser = { 'x-user-email': 'amd.user@example.com' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Seed the database for testing
    console.log('Seeding test database...');
    
    const usersRepository = moduleRef.get(UsersRepository);
    const departmentsRepository = moduleRef.get(DepartmentsRepository);
    const rulesRepository = moduleRef.get(RulesRepository);
    const enforcer = moduleRef.get<Enforcer>('CASBIN_ENFORCER');

    // Seed in correct order
    const users = await usersRepository.seed();
    departments = await departmentsRepository.seed();
    await rulesRepository.seed(departments);
    
    // Clear and seed Casbin policies
    await enforcer.clearPolicy();
    await seedPolicies(enforcer, users);
    
    console.log('Test database seeded successfully');
  });

  afterAll(async () => {
    await app.close();
  });


  const getDeptId = (code: string) => {
    const dept = departments.find(d => d.code === code);
    if (!dept) {
      console.error(`Department with code '${code}' not found. Available departments:`, departments.map(d => d.code));
      throw new Error(`Department with code '${code}' not found`);
    }
    return dept.id;
  };

  it('Visibility: HR Head can list HR requests, but not Marketing requests', async () => {
    await request(app.getHttpServer())
      .get(`/requests?departmentId=${getDeptId('HR')}`)
      .set(hrHead)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/requests?departmentId=${getDeptId('MKT')}`)
      .set(hrHead)
      .expect(403);
  });

  it('Create/Submit: HR User can create and submit a request in HR department', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { amount: 500 } })
      .expect(201);

    expect(newRequest.id).toBeDefined();
    expect(newRequest.status).toBe('DRAFT');

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);
  });

  it('GetById: HR Head can get a request from the HR department', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { amount: 500 } })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/requests/${newRequest.id}`)
      .set(hrHead)
      .expect(200);
  });

  it('3-Step Approval: HR request goes through HD then AF then CG approval (legacy test)', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { amount: 500 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // Step 1: HR Head approval moves to AF_REVIEW stage
    const { body: afterHDApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterHDApproval.status).toBe('IN_REVIEW');
    expect(afterHDApproval.stageCode).toBe('AF_REVIEW');

    // Step 2: AF approval moves to CG_REVIEW stage
    const { body: afterAFApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterAFApproval.status).toBe('IN_REVIEW');
    expect(afterAFApproval.stageCode).toBe('CG_REVIEW');

    // Step 3: CG approval completes the process
    const { body: finalApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(finalApproval.status).toBe('APPROVED');
  });

  it('IT Department: Normal 2-step approval workflow works', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(itUser) // IT User creates (not head to avoid self-approval issue)
      .send({ departmentId: getDeptId('IT'), payload: { amount: 1000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(itUser)
      .expect(200);

    // IT Head approval should work and move to AF_REVIEW (normal 2-step process)
    const { body: afterItApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(itHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterItApproval.status).toBe('IN_REVIEW');
    expect(afterItApproval.stageCode).toBe('AF_REVIEW');

    // AF user can approve AF_REVIEW stage - moves to CG_REVIEW
    const { body: afApprovedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afApprovedRequest.status).toBe('IN_REVIEW');
    expect(afApprovedRequest.stageCode).toBe('CG_REVIEW');

    // CG approval completes the process
    const { body: finalApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(finalApproval.status).toBe('APPROVED');
  });

  it('Bulk Approve: AMD User can bulk approve requests', async () => {
    const requestIds = [];
    for (let i = 0; i < 2; i++) {
      const { body: newRequest } = await request(app.getHttpServer())
        .post('/requests')
        .set(hrUser)
        .send({ departmentId: getDeptId('HR'), payload: { amount: 100 + i } })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/requests/${newRequest.id}/submit`)
        .set(hrUser)
        .expect(200);
      requestIds.push(newRequest.id);
    }

    await request(app.getHttpServer())
      .post('/requests/bulk')
      .set(amdUser)
      .send({ ids: requestIds, action: 'approve' })
      .expect(200);
  });

  it('Unauthorized Bulk Approve: HR Head cannot bulk approve', async () => {
    await request(app.getHttpServer())
      .post('/requests/bulk')
      .set(hrHead)
      .send({ ids: [], action: 'approve' })
      .expect(403);
  });

  it('Duplicate Approval: Approving twice returns a 400 error', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { amount: 500 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // First approval should work
    const { body: afterFirstApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterFirstApproval.stageCode).toBe('AF_REVIEW');

    // AF approval moves to CG_REVIEW stage
    const { body: afterAfApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterAfApproval.stageCode).toBe('CG_REVIEW');

    // CG user approves
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);

    // Try to approve again by CG user after final approval - should fail with 400
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(400);
  });

  // ====== AF DEPARTMENT 1-STEP APPROVAL TESTS ======

  it('1-Step Approval: AF staff can create request in AF department', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(afUser)
      .send({ departmentId: getDeptId('AF'), payload: { type: 'Audit Request', amount: 2000 } })
      .expect(201);

    expect(newRequest.id).toBeDefined();
    expect(newRequest.status).toBe('DRAFT');
    expect(newRequest.departmentId).toBe(getDeptId('AF'));
    expect(newRequest.createdBy).toBeDefined();
  });

  it('1-Step Approval: AF request is approved by AF Head only (no AF_REVIEW)', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(afUser)
      .send({ departmentId: getDeptId('AF'), payload: { type: 'Budget Analysis', amount: 1500 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(afUser)
      .expect(200);

    // AF Head approval should complete the process immediately
    const { body: approvedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(approvedRequest.status).toBe('APPROVED');
    expect(approvedRequest.stageCode).toBe('DEPT_HEAD'); // Should end at DEPT_HEAD, not move to AF_REVIEW
  });

  it('1-Step Approval: AF Head can reject AF department request', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(afUser)
      .send({ departmentId: getDeptId('AF'), payload: { type: 'Unnecessary Expense', amount: 5000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(afUser)
      .expect(200);

    const { body: rejectedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afHead)
      .send({ decision: 'reject' })
      .expect(200);

    expect(rejectedRequest.status).toBe('REJECTED');
  });

  // ====== NON-AF DEPARTMENT 2-STEP APPROVAL TESTS ======

  it('3-Step Approval: Marketing request goes through MKT Head then AF then CG approval', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(mktUser)
      .send({ departmentId: getDeptId('MKT'), payload: { type: 'Campaign Budget', amount: 10000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(mktUser)
      .expect(200);

    // Step 1: MKT Head approval
    const { body: afterMktApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(mktHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterMktApproval.status).toBe('IN_REVIEW');
    expect(afterMktApproval.stageCode).toBe('AF_REVIEW');

    // Step 2: AF Head approval
    const { body: afterAfApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterAfApproval.status).toBe('IN_REVIEW');
    expect(afterAfApproval.stageCode).toBe('CG_REVIEW');

    // Step 3: CG approval
    const { body: finalApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(finalApproval.status).toBe('APPROVED');
  });

  it('2-Step Approval: AF user can approve requests from other departments', async () => {
    // Create HR request
    const { body: hrRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Training Budget', amount: 3000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${hrRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // HR Head approves first
    const { body: afterHRApproval } = await request(app.getHttpServer())
      .post(`/requests/${hrRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterHRApproval.stageCode).toBe('AF_REVIEW');

    // AF user (not head) can also approve AF_REVIEW stage - moves to CG_REVIEW
    const { body: afterAFApproval } = await request(app.getHttpServer())
      .post(`/requests/${hrRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterAFApproval.status).toBe('IN_REVIEW');
    expect(afterAFApproval.stageCode).toBe('CG_REVIEW');

    // CG approval completes the process
    const { body: finalApproval } = await request(app.getHttpServer())
      .post(`/requests/${hrRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(finalApproval.status).toBe('APPROVED');
  });

  it('2-Step Approval: Request can be rejected at AF_REVIEW stage', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(mktUser)
      .send({ departmentId: getDeptId('MKT'), payload: { type: 'Overpriced Campaign', amount: 50000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(mktUser)
      .expect(200);

    // MKT Head approves
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(mktHead)
      .send({ decision: 'approve' })
      .expect(200);

    // AF rejects
    const { body: rejectedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'reject' })
      .expect(200);

    expect(rejectedRequest.status).toBe('REJECTED');
  });

  it('2-Step Approval: Request can be rejected at department head stage', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Unreasonable Request', amount: 100000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // HR Head rejects immediately
    const { body: rejectedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'reject' })
      .expect(200);

    expect(rejectedRequest.status).toBe('REJECTED');
    expect(rejectedRequest.stageCode).toBe('DEPT_HEAD'); // Should remain at DEPT_HEAD stage
  });

  // ====== AUTHORIZATION AND ERROR TESTS ======

  it('Authorization: AF user cannot approve requests in their own department at AF_REVIEW stage', async () => {
    // This test ensures AF department requests don't go through AF_REVIEW
    const { body: afRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(afUser)
      .send({ departmentId: getDeptId('AF'), payload: { type: 'Self Approval Test', amount: 1000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${afRequest.id}/submit`)
      .set(afUser)
      .expect(200);

    // AF Head approves and it should be completed
    const { body: approvedRequest } = await request(app.getHttpServer())
      .post(`/requests/${afRequest.id}/approve`)
      .set(afHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(approvedRequest.status).toBe('APPROVED');
    // If someone tries to approve it again, it should fail with 403 (Forbidden)
    // because the request is already processed and not in a valid state for approval
    await request(app.getHttpServer())
      .post(`/requests/${afRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(403); // Request already processed - no valid stage to approve
  });

  it('Authorization: Non-AF user cannot approve AF_REVIEW stage', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Test Request', amount: 1000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // HR Head approves first
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    // MKT Head should not be able to approve AF_REVIEW stage
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(mktHead)
      .send({ decision: 'approve' })
      .expect(403);
  });

  it('Authorization: User cannot approve their own request', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Self Approval Test', amount: 500 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // User tries to approve their own request
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrUser)
      .send({ decision: 'approve' })
      .expect(403);
  });

  it('Authorization: Cross-department head cannot approve other department requests', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Cross Dept Test', amount: 500 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // MKT Head should not be able to approve HR request at DEPT_HEAD stage
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(mktHead)
      .send({ decision: 'approve' })
      .expect(403);
  });

  // ====== FRONTEND API ENDPOINT TESTS ======

  it('API: GET /users returns users with roles', async () => {
    const { body: users } = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    
    // Check that users have required properties
    const firstUser = users[0];
    expect(firstUser).toHaveProperty('id');
    expect(firstUser).toHaveProperty('email');
    expect(firstUser).toHaveProperty('displayName');
    expect(firstUser).toHaveProperty('roles');
    expect(Array.isArray(firstUser.roles)).toBe(true);
  });

  it('API: GET /users returns specific user roles correctly', async () => {
    const { body: users } = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    // Find HR Head user
    const hrHeadUser = users.find(u => u.email === 'hr.head@example.com');
    expect(hrHeadUser).toBeDefined();
    expect(hrHeadUser.roles).toHaveLength(1);
    expect(hrHeadUser.roles[0]).toEqual({ role: 'HD', department: 'HR' });

    // Find AF user (should have both STAFF and AF_APPROVER roles)
    const afUserData = users.find(u => u.email === 'af.user@example.com');
    expect(afUserData).toBeDefined();
    expect(afUserData.roles).toHaveLength(2);
    expect(afUserData.roles).toContainEqual({ role: 'STAFF', department: 'AF' });
    expect(afUserData.roles).toContainEqual({ role: 'AF_APPROVER', department: '*' });

    // Find AMD user (global role)
    const amdUser = users.find(u => u.email === 'amd.user@example.com');
    expect(amdUser).toBeDefined();
    expect(amdUser.roles).toHaveLength(1);
    expect(amdUser.roles[0]).toEqual({ role: 'AMD', department: '*' });
  });

  it('API: GET /departments/creatable returns departments user can create requests in', async () => {
    const { body: departments } = await request(app.getHttpServer())
      .get('/departments/creatable')
      .set(hrUser)
      .expect(200);

    expect(Array.isArray(departments)).toBe(true);
    expect(departments.length).toBeGreaterThan(0);
    
    // HR user should be able to create requests in HR department
    const hrDept = departments.find(d => d.code === 'HR');
    expect(hrDept).toBeDefined();
    expect(hrDept).toHaveProperty('id');
    expect(hrDept).toHaveProperty('name');
    expect(hrDept).toHaveProperty('code');
    expect(hrDept.code).toBe('HR');
  });

  it('API: GET /departments/creatable returns AF department for AF user', async () => {
    const { body: departments } = await request(app.getHttpServer())
      .get('/departments/creatable')
      .set(afUser)
      .expect(200);

    expect(Array.isArray(departments)).toBe(true);
    
    // AF user should be able to create requests in AF department
    const afDept = departments.find(d => d.code === 'AF');
    expect(afDept).toBeDefined();
    expect(afDept.code).toBe('AF');
  });

  it('API: GET /departments/creatable restrictions by role', async () => {
    // HR User can only create in HR department
    const { body: hrDepartments } = await request(app.getHttpServer())
      .get('/departments/creatable')
      .set(hrUser)
      .expect(200);

    expect(hrDepartments).toHaveLength(1);
    expect(hrDepartments[0].code).toBe('HR');

    // Marketing User can only create in Marketing department  
    const { body: mktDepartments } = await request(app.getHttpServer())
      .get('/departments/creatable')
      .set({ 'x-user-email': 'mkt.user@example.com' })
      .expect(200);

    expect(mktDepartments).toHaveLength(1);
    expect(mktDepartments[0].code).toBe('MKT');

    // IT Head can create in IT department
    const { body: itDepartments } = await request(app.getHttpServer())
      .get('/departments/creatable')
      .set({ 'x-user-email': 'it.head@example.com' })
      .expect(200);

    expect(itDepartments).toHaveLength(1);
    expect(itDepartments[0].code).toBe('IT');
  });

  it('API: GET /departments/creatable for CG department', async () => {
    // CG user can create in CG department
    const { body: cgDepartments } = await request(app.getHttpServer())
      .get('/departments/creatable')
      .set(cgUser)
      .expect(200);

    expect(Array.isArray(cgDepartments)).toBe(true);
    expect(cgDepartments.length).toBe(1);
    expect(cgDepartments[0].code).toBe('CG');
    
    // AMD user has no create permissions  
    const { body: amdDepartments } = await request(app.getHttpServer())
      .get('/departments/creatable')
      .set(amdUser)
      .expect(200);

    expect(Array.isArray(amdDepartments)).toBe(true);
    expect(amdDepartments.length).toBe(0); // AMD has no create permissions
  });

  it('API: GET /requests/reviewable returns requests user can approve', async () => {
    // Create a request that AF user can review
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Test Request', amount: 1000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // HR Head approves to move to AF_REVIEW stage
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    // Now AF user should see this in reviewable requests
    const { body: reviewableRequests } = await request(app.getHttpServer())
      .get('/requests/reviewable')
      .set(afUser)
      .expect(200);

    expect(Array.isArray(reviewableRequests)).toBe(true);
    
    // Should contain the request we just moved to AF_REVIEW
    const foundRequest = reviewableRequests.find(r => r.id === newRequest.id);
    expect(foundRequest).toBeDefined();
    expect(foundRequest.stageCode).toBe('AF_REVIEW');
  });

  it('API: GET /requests/reviewable department head permissions', async () => {
    // Create a request in HR department
    const { body: hrRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'HR Head Test', amount: 2000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${hrRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // HR Head should see this request in reviewable (DEPT_HEAD stage)
    const { body: hrHeadReviewable } = await request(app.getHttpServer())
      .get('/requests/reviewable')
      .set(hrHead)
      .expect(200);

    const foundHrRequest = hrHeadReviewable.find(r => r.id === hrRequest.id);
    expect(foundHrRequest).toBeDefined();
    expect(foundHrRequest.stageCode).toBe('DEPT_HEAD');

    // Marketing Head should NOT see HR requests
    const { body: mktHeadReviewable } = await request(app.getHttpServer())
      .get('/requests/reviewable')
      .set(mktHead)
      .expect(200);

    const shouldNotExist = mktHeadReviewable.find(r => r.id === hrRequest.id);
    expect(shouldNotExist).toBeUndefined();
  });

  it('API: GET /requests/reviewable AF approval workflow', async () => {
    // Create requests in different departments to test AF approval
    const { body: mktRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set({ 'x-user-email': 'mkt.user@example.com' })
      .send({ departmentId: getDeptId('MKT'), payload: { type: 'Marketing AF Test', amount: 3000 } })
      .expect(201);

    const { body: itRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set({ 'x-user-email': 'it.user@example.com' })
      .send({ departmentId: getDeptId('IT'), payload: { type: 'IT AF Test', amount: 4000 } })
      .expect(201);

    // Submit both requests
    await request(app.getHttpServer())
      .post(`/requests/${mktRequest.id}/submit`)
      .set({ 'x-user-email': 'mkt.user@example.com' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/requests/${itRequest.id}/submit`)
      .set({ 'x-user-email': 'it.user@example.com' })
      .expect(200);

    // Department heads approve to move to AF_REVIEW stage
    await request(app.getHttpServer())
      .post(`/requests/${mktRequest.id}/approve`)
      .set(mktHead)
      .send({ decision: 'approve' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/requests/${itRequest.id}/approve`)
      .set({ 'x-user-email': 'it.head@example.com' })
      .send({ decision: 'approve' })
      .expect(200);

    // AF user should see both requests in reviewable (AF_REVIEW stage)
    const { body: afReviewable } = await request(app.getHttpServer())
      .get('/requests/reviewable')
      .set(afUser)
      .expect(200);

    const foundMktRequest = afReviewable.find(r => r.id === mktRequest.id);
    const foundItRequest = afReviewable.find(r => r.id === itRequest.id);
    
    expect(foundMktRequest).toBeDefined();
    expect(foundMktRequest.stageCode).toBe('AF_REVIEW');
    expect(foundItRequest).toBeDefined();
    expect(foundItRequest.stageCode).toBe('AF_REVIEW');
  });

  it('API: GET /requests/reviewable returns proper request structure', async () => {
    // Create and submit a request
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Structure Test', description: 'Check response structure' } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // Get reviewable requests for HR Head
    const { body: reviewableRequests } = await request(app.getHttpServer())
      .get('/requests/reviewable')
      .set(hrHead)
      .expect(200);

    expect(Array.isArray(reviewableRequests)).toBe(true);
    
    const foundRequest = reviewableRequests.find(r => r.id === newRequest.id);
    expect(foundRequest).toBeDefined();
    
    // Check request has proper structure with permittedActions
    expect(foundRequest).toHaveProperty('id');
    expect(foundRequest).toHaveProperty('departmentId');
    expect(foundRequest).toHaveProperty('createdBy');
    expect(foundRequest).toHaveProperty('status');
    expect(foundRequest).toHaveProperty('stageCode');
    expect(foundRequest).toHaveProperty('payload');
    expect(foundRequest).toHaveProperty('permittedActions');
    expect(Array.isArray(foundRequest.permittedActions)).toBe(true);
    
    // HR Head should be able to approve this request
    expect(foundRequest.permittedActions).toContain('approve');
  });

  it('API: GET /requests with departmentId returns department requests', async () => {
    // Create a request in HR department
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'Department Test', amount: 500 } })
      .expect(201);

    // HR Head should be able to list HR department requests
    const { body: requests } = await request(app.getHttpServer())
      .get(`/requests?departmentId=${getDeptId('HR')}`)
      .set(hrHead)
      .expect(200);

    expect(Array.isArray(requests)).toBe(true);
    
    // Should contain the request we just created
    const foundRequest = requests.find(r => r.id === newRequest.id);
    expect(foundRequest).toBeDefined();
    expect(foundRequest.departmentId).toBe(getDeptId('HR'));
  });

  it('API: POST /requests creates request and returns permittedActions', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(afUser)
      .send({ departmentId: getDeptId('AF'), payload: { content: 'Test request content' } })
      .expect(201);

    expect(newRequest).toHaveProperty('id');
    expect(newRequest).toHaveProperty('status', 'DRAFT');
    expect(newRequest).toHaveProperty('departmentId', getDeptId('AF'));
    expect(newRequest).toHaveProperty('permittedActions');
    expect(Array.isArray(newRequest.permittedActions)).toBe(true);
    
    // DRAFT requests should allow submit action
    expect(newRequest.permittedActions).toContain('submit');
  });

  // ====== 3-STEP APPROVAL WORKFLOW TESTS ======

  it('3-Step Approval: HR request goes through HD -> AF -> CG approval', async () => {
    // Create request in HR department
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: '3-Step Test', amount: 50000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // Step 1: HR Head approves (DEPT_HEAD stage)
    let { body: updatedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(updatedRequest.status).toBe('IN_REVIEW');
    expect(updatedRequest.stageCode).toBe('AF_REVIEW');

    // Step 2: AF user approves (AF_REVIEW stage)
    ({ body: updatedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200));

    expect(updatedRequest.status).toBe('IN_REVIEW');
    expect(updatedRequest.stageCode).toBe('CG_REVIEW');

    // Step 3: CG user approves (CG_REVIEW stage) - final approval
    ({ body: updatedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200));

    expect(updatedRequest.status).toBe('APPROVED');
    expect(updatedRequest.stageCode).toBe('CG_REVIEW'); // Stays at final stage
  });

  it('1-Step Approval: CG department request approved by CG Head only', async () => {
    // Create request in CG department
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(cgUser)
      .send({ departmentId: getDeptId('CG'), payload: { type: 'CG Internal', description: 'Strategy review' } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(cgUser)
      .expect(200);

    // CG Head approves and request is immediately APPROVED (1-step)
    const { body: updatedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(updatedRequest.status).toBe('APPROVED');
    expect(updatedRequest.stageCode).toBe('DEPT_HEAD'); // Ends at department head stage
  });

  it('3-Step Approval: CG user can approve requests from other departments at CG_REVIEW', async () => {
    // Create request in Marketing department
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(mktUser)
      .send({ departmentId: getDeptId('MKT'), payload: { type: 'CG Review Test', amount: 100000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(mktUser)
      .expect(200);

    // MKT Head approves
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(mktHead)
      .send({ decision: 'approve' })
      .expect(200);

    // AF user approves
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    // CG user can approve CG_REVIEW stage for cross-department requests
    const { body: updatedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(updatedRequest.status).toBe('APPROVED');
  });

  it('Authorization: CG user cannot approve requests in their own department at CG_REVIEW stage', async () => {
    // This is similar to AF constraint - department users can't approve their own dept at their special approval stage
    // Create request in another department and move it to CG_REVIEW
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(itUser)
      .send({ departmentId: getDeptId('IT'), payload: { type: 'IT CG Test', amount: 75000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(itUser)
      .expect(200);

    // IT Head and AF approve to get to CG_REVIEW
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(itHead)
      .send({ decision: 'approve' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    // CG user should be able to approve this (it's not from CG department)
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);
  });

  it('API: GET /users returns CG user roles correctly', async () => {
    const { body: users } = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    // Find CG user (should have both STAFF and CG_APPROVER roles)
    const cgUserData = users.find(u => u.email === 'cg.user@example.com');
    expect(cgUserData).toBeDefined();
    expect(cgUserData.roles).toHaveLength(2);
    expect(cgUserData.roles).toContainEqual({ role: 'STAFF', department: 'CG' });
    expect(cgUserData.roles).toContainEqual({ role: 'CG_APPROVER', department: '*' });

    // Find CG Head user
    const cgHeadData = users.find(u => u.email === 'cg.head@example.com');
    expect(cgHeadData).toBeDefined();
    expect(cgHeadData.roles).toHaveLength(2);
    expect(cgHeadData.roles).toContainEqual({ role: 'HD', department: 'CG' });
    expect(cgHeadData.roles).toContainEqual({ role: 'CG_APPROVER', department: '*' });
  });

  it('CG Early Visibility: CG can view AF_REVIEW requests but cannot approve them', async () => {
    // Create an HR request
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { type: 'CG Early View Test', amount: 5000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    // HR Head approves - moves to AF_REVIEW stage
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    // CG user should see this request in reviewable but with no actions (view-only)
    const { body: cgReviewable } = await request(app.getHttpServer())
      .get('/requests/reviewable')
      .set(cgUser)
      .expect(200);

    const foundRequest = cgReviewable.find(r => r.id === newRequest.id);
    expect(foundRequest).toBeDefined();
    expect(foundRequest.stageCode).toBe('AF_REVIEW');
    expect(foundRequest.permittedActions).toEqual([]); // No actions - view only

    // CG should NOT be able to approve at AF_REVIEW stage
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(403); // Forbidden

    // AF user can still approve normally
    const { body: afterAfApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterAfApproval.stageCode).toBe('CG_REVIEW');

    // Now CG can approve at CG_REVIEW stage
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(cgUser)
      .send({ decision: 'approve' })
      .expect(200);
  });

  it('Role Seeding: Verify role assignments are correct and no duplicates', async () => {
    // Check all user roles for completeness and duplicates
    const { body: users } = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    const afUser = users.find(u => u.email === 'af.user@example.com');
    const afHead = users.find(u => u.email === 'af.head@example.com');
    const hrUser = users.find(u => u.email === 'hr.user@example.com');
    const hrHead = users.find(u => u.email === 'hr.head@example.com');
    
    // Verify AF users have correct roles
    expect(afUser.roles).toEqual(expect.arrayContaining([
      { role: 'STAFF', department: 'AF' },
      { role: 'AF_APPROVER', department: '*' }
    ]));
    expect(afUser.roles).toHaveLength(2); // Exactly 2 roles, no duplicates
    
    expect(afHead.roles).toEqual(expect.arrayContaining([
      { role: 'HD', department: 'AF' },
      { role: 'AF_APPROVER', department: '*' }
    ]));
    expect(afHead.roles).toHaveLength(2); // Exactly 2 roles, no duplicates
    
    // Verify non-AF users don't have AF_APPROVER role
    expect(hrUser.roles).toEqual([{ role: 'STAFF', department: 'HR' }]);
    expect(hrHead.roles).toEqual([{ role: 'HD', department: 'HR' }]);
    
    // Check all users for role duplicates
    for (const user of users) {
      const roleKeys = user.roles.map(r => `${r.role}-${r.department}`);
      const uniqueRoleKeys = new Set(roleKeys);
      expect(roleKeys.length).toBe(uniqueRoleKeys.size); // No duplicates
    }
    
    console.log('Role seeding verification passed - no duplicates found');
  });
});