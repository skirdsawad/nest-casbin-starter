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
  const hrUser = { 'x-user-email': 'hr.user@example.com' };
  const mktUser = { 'x-user-email': 'mkt.user@example.com' };
  const itUser = { 'x-user-email': 'it.user@example.com' };
  const afUser = { 'x-user-email': 'af.user@example.com' };
  const amdUser = { 'x-user-email': 'amd.user@example.com' };
  const cgUser = { 'x-user-email': 'cg.user@example.com' };

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

  it('2-Step Approval: HR request goes through HD then AF approval', async () => {
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

    // Step 2: AF approval completes the process
    const { body: finalApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
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

    // AF user can approve AF_REVIEW stage 
    const { body: afApprovedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afApprovedRequest.status).toBe('APPROVED');
  });

  it('Bulk Approve: CG User can bulk approve requests', async () => {
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
      .set(cgUser)
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

    // Now try AF approval twice - first should work, second should fail with 400
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(200);

    // Try to approve again by the same AF user - should fail with 400
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afUser)
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

  it('2-Step Approval: Marketing request goes through MKT Head then AF approval', async () => {
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
    const { body: finalApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(afHead)
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

    // AF user (not head) can also approve AF_REVIEW stage
    const { body: finalApproval } = await request(app.getHttpServer())
      .post(`/requests/${hrRequest.id}/approve`)
      .set(afUser)
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
});