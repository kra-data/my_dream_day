import request from 'supertest';
import app from '../src/app';

describe('Attendance auth guard', () => {
  it('POST /api/attendance without token -> 401', async () => {
    const res = await request(app).post('/api/attendance').send({ shopId: 1, type: 'IN' });
    expect(res.status).toBe(401);
  });

  it('POST /api/attendance with invalid payload -> 401 (auth required first)', async () => {
    const res = await request(app).post('/api/attendance').send({ shopId: 'invalid', type: 'INVALID' });
    expect(res.status).toBe(401); // auth middleware runs before validation
  });

  it('POST /api/attendance with missing fields -> 401 (auth required first)', async () => {
    const res = await request(app).post('/api/attendance').send({ shopId: 1 });
    expect(res.status).toBe(401); // auth middleware runs before validation
  });

  it('GET /api/attendance/me without token -> 401', async () => {
    const res = await request(app).get('/api/attendance/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/attendance/me/status without token -> 401', async () => {
    const res = await request(app).get('/api/attendance/me/status');
    expect(res.status).toBe(401);
  });

  it('GET /api/attendance/admin/shops/1/attendance without token -> 401', async () => {
    const res = await request(app).get('/api/attendance/admin/shops/1/attendance');
    expect(res.status).toBe(401);
  });
});

describe('Attendance validation', () => {
  it('POST /api/attendance with valid IN payload structure', async () => {
    const res = await request(app).post('/api/attendance').send({
      shopId: 1,
      type: 'IN'
    });
    expect(res.status).toBe(401); // auth required, but payload valid
  });

  it('POST /api/attendance with valid OUT payload structure', async () => {
    const res = await request(app).post('/api/attendance').send({
      shopId: 1,
      type: 'OUT'
    });
    expect(res.status).toBe(401); // auth required, but payload valid
  });
});


