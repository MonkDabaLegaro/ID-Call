import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { PhoneMetadataProvider } from './providers/phone-metadata-provider.js';

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

  it('uses an injected metadata provider and exposes its provenance', async () => {
    const provider: PhoneMetadataProvider = {
      name: 'test-provider',
      lookup: () => ({
        e164: '+56223456789',
        countryCode: '56',
        nationalNumber: '223456789',
        regionCode: 'CL',
        numberType: 'FIXED_LINE',
      }),
    };
    const app = buildApp({ phoneMetadataProvider: provider });

    const response = await app.inject({ method: 'GET', url: '/v1/lookup/anything' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.number).toBe('+56223456789');
    expect(body.sources[0].provider).toBe('test-provider');
  });

  it('rejects invalid phone input', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/lookup/not-a-phone' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'INVALID_PHONE_NUMBER' });
  });
});
