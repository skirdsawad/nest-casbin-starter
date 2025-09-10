
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('E2E - Department-scoped approvals (in-memory)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const hdA = { 'x-user-id': 'user_hd_a' };
  const hdB = { 'x-user-id': 'user_hd_b' };
  const amd = { 'x-user-id': 'user_amd_1' };
  const af = { 'x-user-id': 'user_af_1' };
  const cg = { 'x-user-id': 'user_cg_1' };

  it('Visibility: HD of D15 can list D15, cannot list D19; AF can list D19', async () => {
    await request(app.getHttpServer())
      .get('/requests?departmentId=15')
      .set(hdA)
      .expect(200);

    await request(app.getHttpServer())
      .get('/requests?departmentId=19')
      .set(hdA)
      .expect(403);

    await request(app.getHttpServer())
      .get('/requests?departmentId=19')
      .set(af)
      .expect(200);
  });

  it('Create/Edit: HD can create in own department', async () => {
    const res = await request(app.getHttpServer())
      .post('/requests')
      .set(hdA)
      .send({ departmentId: 15, payload: { amount: 1000 } })
      .expect(201);
    expect(res.body.id).toBeDefined();

    await request(app.getHttpServer())
      .post(`/requests/${res.body.id}/submit`)
      .set(hdA)
      .expect(200);
  });

  it('GetById: HD can get own request', async () => {
    const res = await request(app.getHttpServer())
      .post('/requests')
      .set(hdA)
      .send({ departmentId: 15, payload: { amount: 1000 } })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/requests/${res.body.id}`)
      .set(hdA)
      .expect(200);
  });

  it('Two-HD co-approval (D15 requires 2 approvers)', async () => {
    // create
    const { body: r } = await request(app.getHttpServer())
      .post('/requests')
      .set(hdA)
      .send({ departmentId: 15, payload: {} })
      .expect(201);

    // submit
    await request(app.getHttpServer())
      .post(`/requests/${r.id}/submit`)
      .set(hdA)
      .expect(200);

    // first approve by A
    const a1 = await request(app.getHttpServer())
      .post(`/requests/${r.id}/approve`)
      .set(hdA)
      .send({ decision: 'approve' })
      .expect(200);
    expect(a1.body.status).not.toBe('APPROVED');

    // second approve by B -> should approve
    const a2 = await request(app.getHttpServer())
      .post(`/requests/${r.id}/approve`)
      .set(hdB)
      .send({ decision: 'approve' })
      .expect(200);
    expect(a2.body.status).toBe('APPROVED');
  });

  it('Fallback (D19 has no HD -> AMD_REVIEW, AMD can approve)', async () => {
    const { body: r } = await request(app.getHttpServer())
      .post('/requests')
      .set(af) // AF can create anywhere
      .send({ departmentId: 19, payload: {} })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/requests/${r.id}/submit`)
      .set(af)
      .expect(200);

    // AMD approves at fallback stage
    const a = await request(app.getHttpServer())
      .post(`/requests/${r.id}/approve`)
      .set(amd)
      .send({ decision: 'approve' })
      .expect(200);
    expect(a.body.status).toBe('APPROVED');
  });

  it('Bulk approve: CG only', async () => {
    // create three requests
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { body } = await request(app.getHttpServer())
        .post('/requests')
        .set(af)
        .send({ departmentId: 15, payload: {} })
        .expect(201);
      ids.push(body.id);
      await request(app.getHttpServer())
        .post(`/requests/${body.id}/submit`)
        .set(af)
        .expect(200);
    }
    // bulk as CG
    await request(app.getHttpServer())
      .post('/requests/bulk')
      .set(cg)
      .send({ ids, action: 'approve' })
      .expect(200);

    // bulk as non-CG
    await request(app.getHttpServer())
      .post('/requests/bulk')
      .set(hdA)
      .send({ ids, action: 'approve' })
      .expect(403);
  });

  it('Unauthorized attempts & duplicate approval blocked', async () => {
    const { body: r } = await request(app.getHttpServer())
      .post('/requests')
      .set(af)
      .send({ departmentId: 19, payload: {} })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/requests/${r.id}/submit`)
      .set(af)
      .expect(200);

    // HD tries to approve AMD stage -> 403
    await request(app.getHttpServer())
      .post(`/requests/${r.id}/approve`)
      .set(hdA)
      .send({ decision: 'approve' })
      .expect(403);

    // AMD approves once -> ok
    await request(app.getHttpServer())
      .post(`/requests/${r.id}/approve`)
      .set(amd)
      .send({ decision: 'approve' })
      .expect(200);

    // AMD tries approving again -> 500 (Duplicate) in this simple impl
    await request(app.getHttpServer())
      .post(`/requests/${r.id}/approve`)
      .set(amd)
      .send({ decision: 'approve' })
      .expect(400);
  });
});
