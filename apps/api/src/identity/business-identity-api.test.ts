import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { InMemoryReporterRepository } from '../reporters/reporter-repository.js';
import { InMemoryBusinessIdentityRepository } from './business-identity-repository.js';
import { VerifiedBusinessIdentityProvider } from './caller-identity-provider.js';
import { InMemoryCorrectionRepository } from '../corrections/correction-repository.js';

describe('business identity API', () => {
  it('requires reporter auth and validates public claim fields', async () => {
    const app = buildApp();
    const unauthenticated = await app.inject({
      method: 'POST', url: '/v1/business-claims',
      payload: { phoneNumber: '+56912345678', displayName: 'Example Business', publicWebsite: 'https://example.com' },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const reporters = new InMemoryReporterRepository();
    const credential = await reporters.create();
    const configured = buildApp({ reporterRepository: reporters });
    const invalid = await configured.inject({
      method: 'POST', url: '/v1/business-claims',
      headers: { authorization: `Bearer ${credential.token}` },
      payload: { phoneNumber: '+56912345678', displayName: 'X', publicWebsite: 'http://insecure.example.com' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: 'INVALID_BUSINESS_CLAIM' });
  });

  it('creates pending claims that do not appear in lookup until moderated', async () => {
    const reporters = new InMemoryReporterRepository();
    const identities = new InMemoryBusinessIdentityRepository();
    const credential = await reporters.create();
    const app = buildApp({
      reporterRepository: reporters,
      businessIdentityRepository: identities,
      callerIdentityProvider: new VerifiedBusinessIdentityProvider(identities),
      moderationToken: 'moderator-secret',
    });
    const created = await app.inject({
      method: 'POST', url: '/v1/business-claims',
      headers: { authorization: `Bearer ${credential.token}` },
      payload: {
        phoneNumber: '+56912345678', displayName: 'Example Business',
        publicWebsite: 'https://example.com', publicAddress: 'Public storefront',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().status).toBe('pending');

    const before = await app.inject({ method: 'GET', url: '/v1/lookup/%2B56912345678' });
    expect(before.json().identity).toBeNull();

    const moderated = await app.inject({
      method: 'PATCH', url: `/v1/moderation/business-claims/${created.json().claimId}`,
      headers: { authorization: 'Bearer moderator-secret' },
      payload: { decision: 'verified' },
    });
    expect(moderated.statusCode).toBe(200);
    expect(moderated.json().status).toBe('verified');

    const after = await app.inject({ method: 'GET', url: '/v1/lookup/%2B56912345678' });
    expect(after.json().identity.displayName).toBe('Example Business');
    expect(after.json().identity.verification).toBe('verified');
  });

  it('protects moderation routes with a dedicated token', async () => {
    const app = buildApp({ moderationToken: 'moderator-secret' });
    const denied = await app.inject({ method: 'GET', url: '/v1/moderation/business-claims?status=pending' });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toEqual({ error: 'MODERATOR_AUTH_REQUIRED' });
  });

  it('moderates corrections without automatically changing reputation', async () => {
    const reporters = new InMemoryReporterRepository();
    const corrections = new InMemoryCorrectionRepository();
    const credential = await reporters.create();
    const app = buildApp({
      reporterRepository: reporters,
      correctionRepository: corrections,
      moderationToken: 'moderator-secret',
    });
    const created = await app.inject({
      method: 'POST', url: '/v1/corrections',
      headers: { authorization: `Bearer ${credential.token}` },
      payload: { phoneNumber: '+56912345678', kind: 'number_reassigned', reason: 'Public reassignment evidence' },
    });
    const decision = await app.inject({
      method: 'PATCH', url: `/v1/moderation/corrections/${created.json().correctionId}`,
      headers: { authorization: 'Bearer moderator-secret' },
      payload: { decision: 'accepted' },
    });
    expect(decision.statusCode).toBe(200);
    expect(decision.json().status).toBe('accepted');
  });
});
