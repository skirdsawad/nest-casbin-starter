import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DepartmentsRepository } from '../../src/departments/departments.repository';
import { Department } from '../../src/common/entities/department.entity';

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
  const afUser = { 'x-user-email': 'af.user@example.com' };
  const amdUser = { 'x-user-email': 'amd.user@example.com' };
  const cgUser = { 'x-user-email': 'cg.user@example.com' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Fetch departments to use their IDs in tests
    const departmentsRepository = moduleRef.get(DepartmentsRepository);
    departments = await departmentsRepository.findAll();
  });

  afterAll(async () => {
    await app.close();
  });

  const getDeptId = (code: string) => departments.find(d => d.code === code)!.id;

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

  it('Fallback Approval: AMD User can approve a request in the IT department', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(itHead) // IT Head creates
      .send({ departmentId: getDeptId('IT'), payload: { amount: 1000 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(itHead)
      .expect(200);

    // IT Head approval is not enough, it should fallback to AMD
    const { body: afterItApproval } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(itHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(afterItApproval.status).toBe('IN_REVIEW');
    expect(afterItApproval.stageCode).toBe('AMD_REVIEW');

    const { body: amdApprovedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(amdUser)
      .send({ decision: 'approve' })
      .expect(200);

    expect(amdApprovedRequest.status).toBe('APPROVED');
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

    // Try to approve again at the same stage - should fail
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
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
    // If someone tries to approve it again (as if it were in AF_REVIEW), it should fail
    await request(app.getHttpServer())
      .post(`/requests/${afRequest.id}/approve`)
      .set(afUser)
      .send({ decision: 'approve' })
      .expect(400); // Request already processed
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
});