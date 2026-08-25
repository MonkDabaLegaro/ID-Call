import Fastify from 'fastify';
import type { LookupResponse } from '@id-call/contracts';
import {
  LibPhoneNumberMetadataProvider,
  type PhoneMetadataProvider,
} from './providers/phone-metadata-provider.js';
import {
  InMemoryReputationRepository,
  isReportCategory,
  scoreStoredReports,
  type ReputationRepository,
} from './reputation/reputation-repository.js';

const LOCATION_DISCLAIMER = 'Numbering metadata is not the caller device GPS location or a private residential address.';

type AppDependencies = {
  phoneMetadataProvider?: PhoneMetadataProvider;
  reputationRepository?: ReputationRepository;
};

export function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({ logger: false });
  const phoneMetadataProvider = dependencies.phoneMetadataProvider ?? new LibPhoneNumberMetadataProvider();
  const reputationRepository = dependencies.reputationRepository ?? new InMemoryReputationRepository();

  app.get('/health', async () => ({ status: 'ok' }));

  app.get<{ Params: { phoneNumber: string } }>('/v1/lookup/:phoneNumber', async (request, reply) => {
    try {
      const phone = phoneMetadataProvider.lookup(request.params.phoneNumber);
      const reputation = scoreStoredReports(await reputationRepository.list(phone.e164));
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
          disclaimer: LOCATION_DISCLAIMER,
        },
        reputation,
        sources: [{
          provider: phoneMetadataProvider.name,
          field: 'number-metadata',
          confidence: 1,
          observedAt: now,
        }],
        cachedAt: now,
      };
      return result;
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
  });

  app.post<{ Body: { phoneNumber?: string; category?: unknown } }>('/v1/reports', async (request, reply) => {
    if (!request.body?.phoneNumber || !isReportCategory(request.body.category)) {
      return reply.code(400).send({ error: 'INVALID_REPORT' });
    }
    try {
      const phone = phoneMetadataProvider.lookup(request.body.phoneNumber);
      await reputationRepository.add({
        number: phone.e164,
        countryCode: phone.countryCode,
        regionCode: phone.regionCode,
        numberType: phone.numberType,
      }, request.body.category);
      const reputation = scoreStoredReports(await reputationRepository.list(phone.e164));
      return reply.code(201).send({ number: phone.e164, category: request.body.category, reputation });
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
  });

  return app;
}
