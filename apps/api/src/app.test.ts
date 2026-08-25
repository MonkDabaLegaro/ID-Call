import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('API', () => {
  it('reports health', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('returns deterministic metadata for a valid number', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/lookup/%2B56912345678' });
    expect(response.statusCode).toBe(200);
    expect(response.json().number).toBe('+56912345678');
  });

  it('rejects invalid phone input', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/lookup/not-a-phone' });
    expect(response.statusCode).toBe(400);
  });
});
