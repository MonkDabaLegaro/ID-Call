import Fastify from 'fastify';
import { normalizePhoneNumber } from '@id-call/phone-domain';
import { scoreReputation } from '@id-call/reputation-domain';
import type { LookupResponse } from '@id-call/contracts';

const LOCATION_DISCLAIMER = 'Numbering metadata is not the caller device GPS location or a private residential address.';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get<{ Params: { phoneNumber: string } }>('/v1/lookup/:phoneNumber', async (request, reply) => {
    try {
      const phone = normalizePhoneNumber(request.params.phoneNumber);
      const reputation = scoreReputation([]);
      const now = new Date().toISOString();
      const result: LookupResponse = {
        number: phone.e164,
        valid: true,
        countryCode: phone.countryCode,
        nationalNumber: phone.nationalNumber,
        regionCode: phone.regionCode,
        numberType: phone.numberType,
        location: {
          label: phone.regionCode,
          precision: phone.regionCode ? 'country' : 'unknown',
          disclaimer: LOCATION_DISCLAIMER
        },
        reputation,
        sources: [{ provider: 'libphonenumber-js', field: 'number-metadata', confidence: 1, observedAt: now }],
        cachedAt: now
      };
      return result;
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
  });

  return app;
}
