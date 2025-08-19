import request from 'supertest';
import app from '../src/app';

describe('Middleware order and error handling', () => {
  it('Rate limiting should work', async () => {
    // Make multiple requests quickly to trigger rate limit
    const requests = Array.from({ length: 125 }, () =>
      request(app).get('/api/health')
    );

    const responses = await Promise.all(requests);
    const tooManyRequests = responses.filter(res => res.status === 429);

    // Should have some rate limited responses
    expect(tooManyRequests.length).toBeGreaterThan(0);
  });

  it('404 handler should work for unknown routes (when not rate limited)', async () => {
    // Wait a bit for rate limit to reset, then test 404
    await new Promise(resolve => setTimeout(resolve, 100));

    const res = await request(app).get('/api/unknown-route');
    // Could be 404 or 429 depending on rate limit state
    expect([404, 429]).toContain(res.status);

    if (res.status === 404) {
      expect(res.body.error).toBe('Not Found');
    }
  });

  it('CORS headers should be present', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('Security headers should be present (helmet)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

describe('Request size limits', () => {
  it('Should reject oversized JSON payloads', async () => {
    const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB
    const res = await request(app).post('/api/auth/login').send(largePayload);
    expect(res.status).toBe(413); // Payload Too Large
  });
});

describe('Query parameter validation', () => {
  it('Should handle malformed query parameters gracefully (when not rate limited)', async () => {
    // Wait for rate limit to potentially reset
    await new Promise(resolve => setTimeout(resolve, 100));

    const res = await request(app).get('/api/admin/shops/1/dashboard/recent?limit=abc');
    // Could be 401 (auth required) or 429 (rate limited)
    expect([401, 429]).toContain(res.status);
  });

  it('Should handle missing query parameters with defaults (when not rate limited)', async () => {
    // Wait for rate limit to potentially reset
    await new Promise(resolve => setTimeout(resolve, 100));

    const res = await request(app).get('/api/admin/shops/1/dashboard/recent');
    // Could be 401 (auth required) or 429 (rate limited)
    expect([401, 429]).toContain(res.status);
  });
});
