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
  const hrUser = { 'x-user-email': 'hr.user@example.com' };
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

  it('Approval: HR Head can approve a request in the HR department', async () => {
    const { body: newRequest } = await request(app.getHttpServer())
      .post('/requests')
      .set(hrUser)
      .send({ departmentId: getDeptId('HR'), payload: { amount: 500 } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/submit`)
      .set(hrUser)
      .expect(200);

    const { body: approvedRequest } = await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    expect(approvedRequest.status).toBe('APPROVED');
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

    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(200);

    // Try to approve again
    await request(app.getHttpServer())
      .post(`/requests/${newRequest.id}/approve`)
      .set(hrHead)
      .send({ decision: 'approve' })
      .expect(400);
  });
});