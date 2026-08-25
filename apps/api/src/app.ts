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
  isCorrectionDecision,
  isCorrectionKind,
  type CorrectionRepository,
} from './corrections/correction-repository.js';
import {
  InMemoryBusinessIdentityRepository,
  isBusinessClaimDecision,
  type BusinessIdentityRepository,
} from './identity/business-identity-repository.js';
import {
  VerifiedBusinessIdentityProvider,
  type CallerIdentityProvider,
} from './identity/caller-identity-provider.js';

const LOCATION_DISCLAIMER = 'Numbering metadata is not the caller device GPS location or a private residential address.';

type AppDependencies = {
  phoneMetadataProvider?: PhoneMetadataProvider;
  reputationRepository?: ReputationRepository;
  reporterRepository?: ReporterRepository;
  reportRateLimiter?: ReportRateLimiter;
  correctionRepository?: CorrectionRepository;
  businessIdentityRepository?: BusinessIdentityRepository;
  callerIdentityProvider?: CallerIdentityProvider;
  moderationToken?: string;
};

type BusinessClaimBody = {
  phoneNumber?: string;
  displayName?: string;
  publicWebsite?: string | null;
  publicAddress?: string | null;
};

function targetKey(number: string): string {
  return createHash('sha256').update(number).digest('hex');
}

function moderatorAuthorized(header: string | undefined, token: string | undefined): boolean {
  if (!token || !header?.startsWith('Bearer ')) return false;
  return header.slice('Bearer '.length) === token;
}

function validBusinessClaim(body: BusinessClaimBody | undefined): body is Required<Pick<BusinessClaimBody, 'phoneNumber' | 'displayName'>> & BusinessClaimBody {
  if (!body?.phoneNumber || typeof body.displayName !== 'string') return false;
  const displayName = body.displayName.trim();
  if (displayName.length < 2 || displayName.length > 120) return false;
  if (body.publicWebsite !== undefined && body.publicWebsite !== null) {
    if (typeof body.publicWebsite !== 'string' || body.publicWebsite.length > 300) return false;
    try {
      const parsed = new URL(body.publicWebsite);
      if (parsed.protocol !== 'https:') return false;
    } catch {
      return false;
    }
  }
  if (body.publicAddress !== undefined && body.publicAddress !== null) {
    if (typeof body.publicAddress !== 'string' || body.publicAddress.length > 300) return false;
  }
  return true;
}

export function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({ logger: false });
  const phoneMetadataProvider = dependencies.phoneMetadataProvider ?? new LibPhoneNumberMetadataProvider();
  const reputationRepository = dependencies.reputationRepository ?? new InMemoryReputationRepository();
  const reporterRepository = dependencies.reporterRepository ?? new InMemoryReporterRepository();
  const reportRateLimiter = dependencies.reportRateLimiter ?? new InMemoryReportRateLimiter();
  const correctionRepository = dependencies.correctionRepository ?? new InMemoryCorrectionRepository();
  const businessIdentityRepository = dependencies.businessIdentityRepository ?? new InMemoryBusinessIdentityRepository();
  const callerIdentityProvider = dependencies.callerIdentityProvider
    ?? new VerifiedBusinessIdentityProvider(businessIdentityRepository);
  const moderationToken = dependencies.moderationToken;

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/reporters', async (_request, reply) => {
    const credential = await reporterRepository.create();
    return reply.code(201).send(credential);
  });

  app.get<{ Params: { phoneNumber: string } }>('/v1/lookup/:phoneNumber', async (request, reply) => {
    try {
      const phone = phoneMetadataProvider.lookup(request.params.phoneNumber);
      const nowDate = new Date();
      const reputation = scoreStoredReports(await reputationRepository.list(phone.e164, nowDate), nowDate);
      const identityCandidates = await callerIdentityProvider.lookup(phone.e164, nowDate);
      const selectedIdentity = identityCandidates[0] ?? null;
      const now = nowDate.toISOString();
      const sources = [{
        provider: phoneMetadataProvider.name,
        field: 'number-metadata',
        confidence: 1,
        observedAt: now,
      }];
      for (const candidate of identityCandidates) {
        sources.push({
          provider: candidate.provider,
          field: 'business-identity',
          confidence: candidate.confidence,
          observedAt: candidate.observedAt.toISOString(),
        });
      }
      const result: LookupResponse = {
        number: phone.e164,
        valid: true,
        countryCode: phone.countryCode,
        nationalNumber: phone.nationalNumber,
        regionCode: phone.regionCode,
        numberType: phone.numberType,
        identity: selectedIdentity ? {
          displayName: selectedIdentity.displayName,
          identityType: selectedIdentity.identityType,
          verification: selectedIdentity.verification,
          confidence: selectedIdentity.confidence,
          publicWebsite: selectedIdentity.publicWebsite,
          publicAddress: selectedIdentity.publicAddress,
          expiresAt: selectedIdentity.expiresAt?.toISOString() ?? null,
        } : null,
        location: {
          label: phone.regionCode,
          precision: phone.regionCode ? 'country' : 'unknown',
          disclaimer: LOCATION_DISCLAIMER,
        },
        reputation,
        sources,
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
    let phone;
    try {
      phone = phoneMetadataProvider.lookup(request.body.phoneNumber);
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
    const decision = await reportRateLimiter.checkReport(reporter.id, targetKey(phone.e164));
    if (!decision.allowed) {
      if (decision.retryAfterSeconds) reply.header('Retry-After', String(decision.retryAfterSeconds));
      return reply.code(429).send({ error: 'REPORT_RATE_LIMITED' });
    }
    const upsert = await reputationRepository.upsert({
      number: phone.e164,
      countryCode: phone.countryCode,
      regionCode: phone.regionCode,
      numberType: phone.numberType,
    }, {
      id: reporter.id,
      trust: calculateReporterTrust(reporter),
    }, request.body.category);
    if (upsert.created) await reporterRepository.incrementAcceptedReports(reporter.id);
    const reputation = scoreStoredReports(await reputationRepository.list(phone.e164));
    return reply.code(201).send({
      reportId: upsert.report.id,
      number: phone.e164,
      category: upsert.report.category,
      reputation,
    });
  });

  app.delete<{ Params: { reportId: string } }>('/v1/reports/:reportId', async (request, reply) => {
    const reporter = await authenticateBearer(request.headers.authorization, reporterRepository);
    if (!reporter) return reply.code(401).send({ error: 'REPORTER_AUTH_REQUIRED' });
    const withdrawn = await reputationRepository.withdraw(request.params.reportId, reporter.id);
    if (!withdrawn) return reply.code(404).send({ error: 'REPORT_NOT_FOUND' });
    return reply.code(204).send();
  });

  app.post<{ Body: { phoneNumber?: string; kind?: unknown; reason?: unknown } }>('/v1/corrections', async (request, reply) => {
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
    let phone;
    try {
      phone = phoneMetadataProvider.lookup(request.body.phoneNumber);
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
    const correction = await correctionRepository.create({
      number: phone.e164,
      countryCode: phone.countryCode,
      regionCode: phone.regionCode,
      numberType: phone.numberType,
    }, reporter.id, request.body.kind, typeof reason === 'string' ? reason : null);
    return reply.code(201).send({ correctionId: correction.id, status: correction.status });
  });

  app.post<{ Body: BusinessClaimBody }>('/v1/business-claims', async (request, reply) => {
    if (!validBusinessClaim(request.body)) {
      return reply.code(400).send({ error: 'INVALID_BUSINESS_CLAIM' });
    }
    const reporter = await authenticateBearer(request.headers.authorization, reporterRepository);
    if (!reporter) return reply.code(401).send({ error: 'REPORTER_AUTH_REQUIRED' });
    const limit = await reportRateLimiter.checkCorrection(reporter.id);
    if (!limit.allowed) {
      if (limit.retryAfterSeconds) reply.header('Retry-After', String(limit.retryAfterSeconds));
      return reply.code(429).send({ error: 'REPORT_RATE_LIMITED' });
    }
    let phone;
    try {
      phone = phoneMetadataProvider.lookup(request.body.phoneNumber);
    } catch {
      return reply.code(400).send({ error: 'INVALID_PHONE_NUMBER' });
    }
    const claim = await businessIdentityRepository.create({
      number: phone.e164,
      countryCode: phone.countryCode,
      regionCode: phone.regionCode,
      numberType: phone.numberType,
    }, reporter.id, {
      displayName: request.body.displayName.trim(),
      publicWebsite: request.body.publicWebsite ?? null,
      publicAddress: request.body.publicAddress ?? null,
    });
    return reply.code(201).send({ claimId: claim.id, status: claim.status });
  });

  app.get<{ Querystring: { status?: string } }>('/v1/moderation/business-claims', async (request, reply) => {
    if (!moderatorAuthorized(request.headers.authorization, moderationToken)) {
      return reply.code(401).send({ error: 'MODERATOR_AUTH_REQUIRED' });
    }
    const status = request.query.status ?? 'pending';
    if (!['pending', 'verified', 'rejected', 'expired'].includes(status)) {
      return reply.code(400).send({ error: 'INVALID_MODERATION_DECISION' });
    }
    return businessIdentityRepository.listByStatus(status as any);
  });

  app.patch<{ Params: { claimId: string }; Body: { decision?: unknown } }>(
    '/v1/moderation/business-claims/:claimId',
    async (request, reply) => {
      if (!moderatorAuthorized(request.headers.authorization, moderationToken)) {
        return reply.code(401).send({ error: 'MODERATOR_AUTH_REQUIRED' });
      }
      if (!isBusinessClaimDecision(request.body?.decision)) {
        return reply.code(400).send({ error: 'INVALID_MODERATION_DECISION' });
      }
      const claim = await businessIdentityRepository.decide(request.params.claimId, request.body.decision);
      if (!claim) return reply.code(404).send({ error: 'MODERATION_ITEM_NOT_FOUND' });
      return { claimId: claim.id, status: claim.status };
    },
  );

  app.get<{ Querystring: { status?: string } }>('/v1/moderation/corrections', async (request, reply) => {
    if (!moderatorAuthorized(request.headers.authorization, moderationToken)) {
      return reply.code(401).send({ error: 'MODERATOR_AUTH_REQUIRED' });
    }
    const status = request.query.status ?? 'pending';
    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return reply.code(400).send({ error: 'INVALID_MODERATION_DECISION' });
    }
    return correctionRepository.listByStatus(status as any);
  });

  app.patch<{ Params: { correctionId: string }; Body: { decision?: unknown } }>(
    '/v1/moderation/corrections/:correctionId',
    async (request, reply) => {
      if (!moderatorAuthorized(request.headers.authorization, moderationToken)) {
        return reply.code(401).send({ error: 'MODERATOR_AUTH_REQUIRED' });
      }
      if (!isCorrectionDecision(request.body?.decision)) {
        return reply.code(400).send({ error: 'INVALID_MODERATION_DECISION' });
      }
      const correction = await correctionRepository.decide(request.params.correctionId, request.body.decision);
      if (!correction) return reply.code(404).send({ error: 'MODERATION_ITEM_NOT_FOUND' });
      return { correctionId: correction.id, status: correction.status };
    },
  );

  return app;
}
