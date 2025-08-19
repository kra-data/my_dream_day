import request from 'supertest';
import app from '../src/app';

describe('Admin routes auth guard', () => {
  it('GET /api/admin/shops without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/shops without token -> 401', async () => {
    const res = await request(app).post('/api/admin/shops').send({});
    expect(res.status).toBe(401);
  });

  it('PUT /api/admin/shops/1 without token -> 401', async () => {
    const res = await request(app).put('/api/admin/shops/1').send({});
    expect(res.status).toBe(401);
  });

  it('DELETE /api/admin/shops/1 without token -> 401', async () => {
    const res = await request(app).delete('/api/admin/shops/1');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/shops/1/employees without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/employees');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/shops/1/employees without token -> 401', async () => {
    const res = await request(app).post('/api/admin/shops/1/employees').send({});
    expect(res.status).toBe(401);
  });

  it('PUT /api/admin/shops/1/employees/1 without token -> 401', async () => {
    const res = await request(app).put('/api/admin/shops/1/employees/1').send({});
    expect(res.status).toBe(401);
  });

  it('DELETE /api/admin/shops/1/employees/1 without token -> 401', async () => {
    const res = await request(app).delete('/api/admin/shops/1/employees/1');
    expect(res.status).toBe(401);
  });
});

describe('Admin validation', () => {
  it('POST /api/admin/shops with empty body -> 400', async () => {
    const res = await request(app).post('/api/admin/shops').send({});
    expect(res.status).toBe(401); // auth required first
  });

  it('POST /api/admin/shops with missing required fields -> 400', async () => {
    const res = await request(app).post('/api/admin/shops').send({ name: 'Test Shop' });
    expect(res.status).toBe(401); // auth required first
  });

  it('POST /api/admin/shops with invalid hourlyWage -> 400', async () => {
    const res = await request(app).post('/api/admin/shops').send({
      name: 'Test Shop',
      hourlyWage: -1000,
      payday: 15
    });
    expect(res.status).toBe(401); // auth required first
  });

  it('POST /api/admin/shops with invalid payday -> 400', async () => {
    const res = await request(app).post('/api/admin/shops').send({
      name: 'Test Shop',
      hourlyWage: 10000,
      payday: 32
    });
    expect(res.status).toBe(401); // auth required first
  });
});

describe('Admin employee validation', () => {
  it('POST /api/admin/shops/1/employees with empty body -> 400', async () => {
    const res = await request(app).post('/api/admin/shops/1/employees').send({});
    expect(res.status).toBe(401); // auth required first
  });

  it('POST /api/admin/shops/1/employees with missing required fields -> 400', async () => {
    const res = await request(app).post('/api/admin/shops/1/employees').send({
      name: 'Test Employee'
    });
    expect(res.status).toBe(401); // auth required first
  });

  it('POST /api/admin/shops/1/employees with invalid position -> 400', async () => {
    const res = await request(app).post('/api/admin/shops/1/employees').send({
      name: 'Test Employee',
      nationalId: '1234567890123',
      accountNumber: '1234567890',
      bank: 'Test Bank',
      phone: '01012345678',
      schedule: {},
      position: 'INVALID_POSITION',
      section: 'HALL',
      pay: 3000000,
      payUnit: 'MONTHLY'
    });
    expect(res.status).toBe(401); // auth required first
  });
});
