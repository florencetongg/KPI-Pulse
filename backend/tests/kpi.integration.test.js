process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/user');
const Kpi = require('../models/kpi');
const KpiRecord = require('../models/kpiRecord');

jest.setTimeout(120000);

let replSet;
let managerUser;
let staffUser;
let managerToken;
let staffToken;
let createdKpiId;

const logStatus = (id, method, endpoint, statusCode) => {
  console.info(`${id} ${method} ${endpoint} -> ${statusCode}`);
};

const validKpiPayload = (overrides = {}) => ({
  name: 'Monthly Sales KPI',
  description: 'Track monthly sales performance for the Sales department.',
  category: 'Sales',
  priority: 'high',
  weight: 40,
  assignedTo: staffUser._id.toString(),
  target: 10000,
  unit: 'RM',
  dueDate: new Date('2026-12-31T00:00:00.000Z').toISOString(),
  ...overrides,
});

const createKpi = async (overrides = {}) => {
  return request(app)
    .post('/api/kpis')
    .set('Authorization', `Bearer ${managerToken}`)
    .send(validKpiPayload(overrides));
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  await mongoose.connect(replSet.getUri());

  const hashedPassword = await bcrypt.hash('Password123', 10);

  managerUser = await User.create({
    name: 'Integration Manager',
    email: 'manager.integration@test.com',
    password: hashedPassword,
    role: 'manager',
    department: 'Sales',
  });

  staffUser = await User.create({
    name: 'Integration Staff',
    email: 'staff.integration@test.com',
    password: hashedPassword,
    role: 'staff',
    department: 'Sales',
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await replSet.stop();
});

describe('Integration Testing - Auth, KPI API, and MongoDB data flow', () => {
  test('IT-01 Frontend -> Backend: POST /api/auth/login with valid credentials returns 200 and JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'manager.integration@test.com',
        password: 'Password123',
      });

    logStatus('IT-01', 'POST', '/api/auth/login', res.statusCode);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    managerToken = res.body.token;
  });

  test('IT-02 Frontend -> Backend: POST /api/auth/login with wrong password returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'manager.integration@test.com',
        password: 'WrongPassword',
      });

    logStatus('IT-02', 'POST', '/api/auth/login', res.statusCode);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('IT-03 Backend -> DB: GET /api/kpis with valid manager token returns 200 and KPI array', async () => {
    const res = await request(app)
      .get('/api/kpis')
      .set('Authorization', `Bearer ${managerToken}`);

    logStatus('IT-03', 'GET', '/api/kpis', res.statusCode);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('IT-04 Backend -> DB: GET /api/kpis with no token returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/kpis');

    logStatus('IT-04', 'GET', '/api/kpis', res.statusCode);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('IT-05 Backend -> DB: POST /api/kpis with valid KPI payload returns 201 and persists new doc', async () => {
    const res = await createKpi();

    logStatus('IT-05', 'POST', '/api/kpis', res.statusCode);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();

    createdKpiId = res.body.data._id;
    const persistedKpi = await Kpi.findById(createdKpiId);
    expect(persistedKpi).not.toBeNull();
    expect(persistedKpi.name).toBe('Monthly Sales KPI');
  });

  test('IT-06 Backend -> DB: POST /api/kpis with missing required field returns 400 Validation error', async () => {
    const res = await request(app)
      .post('/api/kpis')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        description: 'Missing KPI name should fail validation.',
        category: 'Sales',
        assignedTo: staffUser._id.toString(),
        target: 10000,
        unit: 'RM',
        dueDate: new Date('2026-12-31T00:00:00.000Z').toISOString(),
      });

    logStatus('IT-06', 'POST', '/api/kpis', res.statusCode);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('IT-07 Full flow: POST /api/kpis then GET /api/kpis returns the newly created KPI', async () => {
    const createRes = await createKpi({
      name: 'Customer Satisfaction KPI',
      description: 'Track customer satisfaction score.',
      category: 'Customer Service',
      target: 90,
      unit: '%',
    });

    logStatus('IT-07A', 'POST', '/api/kpis', createRes.statusCode);
    expect(createRes.statusCode).toBe(201);

    const getRes = await request(app)
      .get('/api/kpis')
      .set('Authorization', `Bearer ${managerToken}`);

    logStatus('IT-07B', 'GET', '/api/kpis', getRes.statusCode);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.data.some((kpi) => kpi._id === createRes.body.data._id)).toBe(true);
  });

  test('IT-08 Submit -> Review: PUT /api/kpis/:id/submit then PUT /api/kpis/:id/review changes pending -> submitted -> approved', async () => {
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'staff.integration@test.com',
        password: 'Password123',
      });
    staffToken = staffLoginRes.body.token;

    const pendingKpi = await createKpi({
      name: 'Review Flow KPI',
      description: 'KPI used to verify submit and review transition.',
    });
    expect(pendingKpi.statusCode).toBe(201);
    const reviewFlowKpiId = pendingKpi.body.data._id;
    expect(pendingKpi.body.data.status).toBe('pending');

    const submitRes = await request(app)
      .put(`/api/kpis/${reviewFlowKpiId}/submit`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        currentValue: 10000,
        progress: 100,
        status: 'submitted',
        comments: 'Submitted for manager review.',
      });

    logStatus('IT-08A', 'PUT', `/api/kpis/${reviewFlowKpiId}/submit`, submitRes.statusCode);
    expect(submitRes.statusCode).toBe(200);

    const submittedRes = await request(app)
      .get(`/api/kpis/${reviewFlowKpiId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(submittedRes.body.data.status).toBe('submitted');

    const reviewRes = await request(app)
      .put(`/api/kpis/${reviewFlowKpiId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'approved', reviewNote: 'Approved during integration testing.' });

    logStatus('IT-08B', 'PUT', `/api/kpis/${reviewFlowKpiId}/review`, reviewRes.statusCode);
    expect(reviewRes.statusCode).toBe(200);
    expect(reviewRes.body.data.status).toBe('approved');

    const approvedRecord = await KpiRecord.findOne({ kpiId: reviewFlowKpiId, status: 'approved' });
    expect(approvedRecord).not.toBeNull();
  });

  test('IT-09 DB -> Frontend: GET /api/kpi-history/:id/cycles with valid KPI ID returns merged cycle data', async () => {
    const res = await request(app)
      .get(`/api/kpi-history/${createdKpiId}/cycles`)
      .set('Authorization', `Bearer ${managerToken}`);

    logStatus('IT-09', 'GET', `/api/kpi-history/${createdKpiId}/cycles`, res.statusCode);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.kpi).toBeDefined();
    expect(Array.isArray(res.body.data.cycles)).toBe(true);
  });

  test('IT-10 DB -> Frontend: GET /api/kpi-history/:id/cycles with non-existent ID returns 404', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/kpi-history/${fakeId}/cycles`)
      .set('Authorization', `Bearer ${managerToken}`);

    logStatus('IT-10', 'GET', `/api/kpi-history/${fakeId}/cycles`, res.statusCode);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('IT-11 Auth enforcement: DELETE /api/kpis/:id with staff token returns 403 Forbidden', async () => {
    const res = await request(app)
      .delete(`/api/kpis/${createdKpiId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    logStatus('IT-11', 'DELETE', `/api/kpis/${createdKpiId}`, res.statusCode);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('IT-12 Auth enforcement: protected route with expired token returns 401 Unauthorized', async () => {
    const expiredToken = jwt.sign({ id: managerUser._id }, process.env.JWT_SECRET, { expiresIn: '-1s' });

    const res = await request(app)
      .get('/api/kpis')
      .set('Authorization', `Bearer ${expiredToken}`);

    logStatus('IT-12', 'GET', '/api/kpis', res.statusCode);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
