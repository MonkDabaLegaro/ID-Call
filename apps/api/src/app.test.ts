import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { InMemoryReputationRepository } from './reputation/reputation-repository.js';

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

  it('accepts a controlled reputation report and exposes it on lookup', async () => {
    const reputationRepository = new InMemoryReputationRepository();
    const app = buildApp({ reputationRepository });
    const report = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      payload: { phoneNumber: '+56912345678', category: 'scam' },
    });
    expect(report.statusCode).toBe(201);
    const lookup = await app.inject({ method: 'GET', url: '/v1/lookup/%2B56912345678' });
    expect(lookup.json().reputation.reports).toBe(1);
    expect(lookup.json().reputation.level).toBe('medium');
  });

  it('rejects uncontrolled report categories', async () => {
    const app = buildApp();
    const report = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      payload: { phoneNumber: '+56912345678', category: 'private-location' },
    });
    expect(report.statusCode).toBe(400);
    expect(report.json()).toEqual({ error: 'INVALID_REPORT' });
  });
});
