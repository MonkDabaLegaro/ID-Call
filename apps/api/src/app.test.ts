import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { InMemoryReputationRepository } from './reputation/reputation-repository.js';
import { InMemoryReporterRepository } from './reporters/reporter-repository.js';
import { InMemoryReportRateLimiter } from './abuse/report-rate-limiter.js';
import { InMemoryCorrectionRepository } from './corrections/correction-repository.js';

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

  it('registers a pseudonymous reporter', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'POST', url: '/v1/reporters' });
    expect(response.statusCode).toBe(201);
    expect(response.json().reporterId).toBeTruthy();
    expect(response.json().token.length).toBeGreaterThan(32);
  });

  it('requires bearer auth for report mutations', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      payload: { phoneNumber: '+56912345678', category: 'scam' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'REPORTER_AUTH_REQUIRED' });
  });

  it('upserts one reporter vote and exposes it on lookup', async () => {
    const reputationRepository = new InMemoryReputationRepository();
    const reporterRepository = new InMemoryReporterRepository();
    const app = buildApp({ reputationRepository, reporterRepository });
    const credential = await reporterRepository.create();
    const headers = { authorization: `Bearer ${credential.token}` };

    const first = await app.inject({
      method: 'POST', url: '/v1/reports', headers,
      payload: { phoneNumber: '+56912345678', category: 'spam' },
    });
    const second = await app.inject({
      method: 'POST', url: '/v1/reports', headers,
      payload: { phoneNumber: '+56912345678', category: 'scam' },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().reportId).toBe(first.json().reportId);
    const lookup = await app.inject({ method: 'GET', url: '/v1/lookup/%2B56912345678' });
    expect(lookup.json().reputation.reports).toBe(1);
  });

  it('withdraws only an owned report', async () => {
    const reputationRepository = new InMemoryReputationRepository();
    const reporterRepository = new InMemoryReporterRepository();
    const app = buildApp({ reputationRepository, reporterRepository });
    const owner = await reporterRepository.create();
    const stranger = await reporterRepository.create();
    const report = await app.inject({
      method: 'POST', url: '/v1/reports',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { phoneNumber: '+56912345678', category: 'spam' },
    });
    const reportId = report.json().reportId;

    const denied = await app.inject({
      method: 'DELETE', url: `/v1/reports/${reportId}`,
      headers: { authorization: `Bearer ${stranger.token}` },
    });
    expect(denied.statusCode).toBe(404);

    const withdrawn = await app.inject({
      method: 'DELETE', url: `/v1/reports/${reportId}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(withdrawn.statusCode).toBe(204);
  });

  it('creates a pending correction without mutating reputation', async () => {
    const reporterRepository = new InMemoryReporterRepository();
    const corrections = new InMemoryCorrectionRepository();
    const app = buildApp({ reporterRepository, correctionRepository: corrections });
    const credential = await reporterRepository.create();
    const response = await app.inject({
      method: 'POST', url: '/v1/corrections',
      headers: { authorization: `Bearer ${credential.token}` },
      payload: { phoneNumber: '+56912345678', kind: 'number_reassigned', reason: 'Number changed owner' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe('pending');
    expect((await corrections.listForReporter(credential.reporterId))).toHaveLength(1);
  });

  it('rejects correction reasons over 500 characters', async () => {
    const reporterRepository = new InMemoryReporterRepository();
    const app = buildApp({ reporterRepository });
    const credential = await reporterRepository.create();
    const response = await app.inject({
      method: 'POST', url: '/v1/corrections',
      headers: { authorization: `Bearer ${credential.token}` },
      payload: { phoneNumber: '+56912345678', kind: 'other', reason: 'x'.repeat(501) },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'INVALID_CORRECTION' });
  });

  it('returns 429 when the report limiter rejects a mutation', async () => {
    const reporterRepository = new InMemoryReporterRepository();
    const limiter = new InMemoryReportRateLimiter();
    const app = buildApp({ reporterRepository, reportRateLimiter: limiter });
    const credential = await reporterRepository.create();
    const headers = { authorization: `Bearer ${credential.token}` };
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/v1/reports', headers, payload: { phoneNumber: '+56912345678', category: 'spam' } });
    }
    const blocked = await app.inject({ method: 'POST', url: '/v1/reports', headers, payload: { phoneNumber: '+56912345678', category: 'spam' } });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({ error: 'REPORT_RATE_LIMITED' });
    expect(blocked.headers['retry-after']).toBeTruthy();
  });

  it('rejects uncontrolled report categories before mutation', async () => {
    const reporterRepository = new InMemoryReporterRepository();
    const app = buildApp({ reporterRepository });
    const credential = await reporterRepository.create();
    const report = await app.inject({
      method: 'POST', url: '/v1/reports',
      headers: { authorization: `Bearer ${credential.token}` },
      payload: { phoneNumber: '+56912345678', category: 'private-location' },
    });
    expect(report.statusCode).toBe(400);
    expect(report.json()).toEqual({ error: 'INVALID_REPORT' });
  });
});
