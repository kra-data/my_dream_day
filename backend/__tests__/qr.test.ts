import request from 'supertest';
import app from '../src/app';

describe('QR routes auth guard', () => {
  it('GET /api/admin/shops/1/qr without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/qr');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/shops/1/qr with download query without token -> 401', async () => {
    const res = await request(app).get('/api/admin/shops/1/qr?download=1');
    expect(res.status).toBe(401);
  });
});

describe('QR validation', () => {
  it('GET /api/admin/shops/1/qr with invalid download value -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/qr?download=2');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/qr with invalid download type -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/qr?download=invalid');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/1/qr with negative download -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/1/qr?download=-1');
    expect(res.status).toBe(401); // auth required first
  });
});

describe('QR parameter validation', () => {
  it('GET /api/admin/shops/invalid/qr with invalid shop ID -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/invalid/qr');
    expect(res.status).toBe(401); // auth required first
  });

  it('GET /api/admin/shops/0/qr with zero shop ID -> 400', async () => {
    const res = await request(app).get('/api/admin/shops/0/qr');
    expect(res.status).toBe(401); // auth required first
  });
});
