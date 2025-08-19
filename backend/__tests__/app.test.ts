import request from 'supertest';
import app from '../src/app';

describe('Health and Auth', () => {
  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/auth/login with empty body -> 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login with invalid phone format -> 400', async () => {
    const res = await request(app).post('/api/auth/login').send({
      name: '홍길동',
      phoneLastFour: '123' // too short
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/refresh with empty body -> 400', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/logout with empty body -> 400', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/validate without token -> 401', async () => {
    const res = await request(app).get('/api/auth/validate');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/validate with invalid token -> 401', async () => {
    const res = await request(app).get('/api/auth/validate')
      .set('Authorization', 'Bearer invalid_token');
    expect(res.status).toBe(401);
  });
});

describe('Swagger', () => {
  it('GET /api/docs should redirect to Swagger UI', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/api/docs/');
  });

  it('GET /api/docs/ should serve Swagger UI', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});

describe('Protected routes', () => {
  it('GET /api/admin-only without token -> 401', async () => {
    const res = await request(app).get('/api/admin-only');
    expect(res.status).toBe(401);
  });

  it('GET /api/employee-only without token -> 401', async () => {
    const res = await request(app).get('/api/employee-only');
    expect(res.status).toBe(401);
  });

  it('GET /api/common without token -> 401', async () => {
    const res = await request(app).get('/api/common');
    expect(res.status).toBe(401);
  });
});


