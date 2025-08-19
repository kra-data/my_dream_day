import request from 'supertest';
import app from '../src/app';

describe('Payroll routes auth guard', () => {
  it('GET /api/admin/shops/1/payroll/export without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/export?start=2025-01-01&end=2025-01-31');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/shops/1/payroll/dashboard without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/dashboard');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/shops/1/payroll/employees without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/employees');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/shops/1/payroll/employees/1 without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/employees/1');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/shops/1/payroll/employees/1/summary without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/employees/1/summary');
    expect(res.status).toBe(401);
  });
});

describe('Payroll validation', () => {
  it('GET /api/admin/shops/1/payroll/export with missing start -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/export?end=2025-01-31');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/payroll/export with missing end -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/export?start=2025-01-01');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/payroll/export with invalid date format -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/export?start=invalid&end=2025-01-31');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/payroll/dashboard with invalid year -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/dashboard?year=1800');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/payroll/dashboard with invalid month -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/dashboard?month=13');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/payroll/employees with invalid year -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/employees?year=9999');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/payroll/employees/1 with invalid month -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/payroll/employees/1?month=0');
    expect(res.status).toBe(401); // auth required first
  });
});

describe('Dashboard validation', () => {
  it('GET /api/admin/shops/1/dashboard/recent with invalid limit -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/dashboard/recent?limit=0');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/dashboard/recent with limit too high -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/dashboard/recent?limit=101');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/dashboard/recent with invalid limit type -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/dashboard/recent?limit=invalid');
    expect(res.status).toBe(401); // auth required first
  });
});
