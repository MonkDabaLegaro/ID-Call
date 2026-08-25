import { createHash } from 'node:crypto';
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
import {
  InMemoryReporterRepository,
  calculateReporterTrust,
  type ReporterRepository,
} from './reporters/reporter-repository.js';
import { authenticateBearer } from './reporters/reporter-auth.js';
import {
  InMemoryReportRateLimiter,
  type ReportRateLimiter,
} from './abuse/report-rate-limiter.js';
import {
  InMemoryCorrectionRepository,
  isCorrectionKind,
  type CorrectionRepository,
} from './corrections/correction-repository.js';

const LOCATION_DISCLAIMER = 'Numbering metadata is not the caller device GPS location or a private residential address.';

type AppDependencies = {
  phoneMetadataProvider?: PhoneMetadataProvider;
  reputationRepository?: ReputationRepository;
  reporterRepository?: ReporterRepository;
  reportRateLimiter?: ReportRateLimiter;
  correctionRepository?: CorrectionRepository;
};

function targetKey(number: string): string {
  return createHash('sha256').update(number).digest('hex');
}

export function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({ logger: false });
  const phoneMetadataProvider = dependencies.phoneMetadataProvider ?? new LibPhoneNumberMetadataProvider();
  const reputationRepository = dependencies.reputationRepository ?? new InMemoryReputationRepository();
  const reporterRepository = dependencies.reporterRepository ?? new InMemoryReporterRepository();
  const reportRateLimiter = dependencies.reportRateLimiter ?? new InMemoryReportRateLimiter();
  const correctionRepository = dependencies.correctionRepository ?? new InMemoryCorrectionRepository();

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/reporters', async (_request, reply) => {
    const credential = await reporterRepository.create();
    return reply.code(201).send(credential);
  });

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

    const reporter = await authenticateBearer(request.headers.authorization, reporterRepository);
    if (!reporter) return reply.code(401).send({ error: 'REPORTER_AUTH_REQUIRED' });

    try {
      const phone = phoneMetadataProvider.lookup(request.body.phoneNumber);
      const decision = await reportRateLimiter.checkReport(reporter.id, targetKey(phone.e164));
      if (!decision.allowed) {
        if (decision.retryAfterSeconds) reply.header('Retry-After', String(decision.retryAfterSeconds));
        return reply.code(429).send({ error: 'REPORT_RATE_LIMITED' });
      }

      const stored = await reputationRepository.upsert({
        number: phone.e164,
        countryCode: phone.countryCode,
        regionCode: phone.regionCode,
        numberType: phone.numberType,
      }, {
        id: reporter.id,
        trust: calculateReporterTrust(reporter),
      }, request.body.category);
      await reporterRepository.incrementAcceptedReports(reporter.id);
      const reputation = scoreStoredReports(await reputationRepository.list(phone.e164));
      return reply.code(201).send({
        reportId: stored.id,
        number: phone.e164,
        category: stored.category,
        reputation,
      });
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
  });

  app.delete<{ Params: { reportId: string } }>('/v1/reports/:reportId', async (request, reply) => {
    const reporter = await authenticateBearer(request.headers.authorization, reporterRepository);
    if (!reporter) return reply.code(401).send({ error: 'REPORTER_AUTH_REQUIRED' });
    const withdrawn = await reputationRepository.withdraw(request.params.reportId, reporter.id);
    if (!withdrawn) return reply.code(404).send({ error: 'REPORT_NOT_FOUND' });
    return reply.code(204).send();
  });

  app.post<{
    Body: { phoneNumber?: string; kind?: unknown; reason?: unknown };
  }>('/v1/corrections', async (request, reply) => {
    const reason = request.body?.reason;
    if (
      !request.body?.phoneNumber
      || !isCorrectionKind(request.body.kind)
      || (reason !== undefined && reason !== null && typeof reason !== 'string')
      || (typeof reason === 'string' && reason.length > 500)
    ) {
      return reply.code(400).send({ error: 'INVALID_CORRECTION' });
    }

    const reporter = await authenticateBearer(request.headers.authorization, reporterRepository);
    if (!reporter) return reply.code(401).send({ error: 'REPORTER_AUTH_REQUIRED' });

    const decision = await reportRateLimiter.checkCorrection(reporter.id);
    if (!decision.allowed) {
      if (decision.retryAfterSeconds) reply.header('Retry-After', String(decision.retryAfterSeconds));
      return reply.code(429).send({ error: 'REPORT_RATE_LIMITED' });
    }

    try {
      const phone = phoneMetadataProvider.lookup(request.body.phoneNumber);
      const correction = await correctionRepository.create({
        number: phone.e164,
        countryCode: phone.countryCode,
        regionCode: phone.regionCode,
        numberType: phone.numberType,
      }, reporter.id, request.body.kind, typeof reason === 'string' ? reason : null);
      return reply.code(201).send({
        correctionId: correction.id,
        status: correction.status,
      });
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
  });

  return app;
}
