import { buildApp } from './app.js';
import { PostgresReputationRepository } from './reputation/postgres-reputation-repository.js';
import { PostgresReporterRepository } from './reporters/postgres-reporter-repository.js';
import { PostgresCorrectionRepository } from './corrections/postgres-correction-repository.js';
import { RedisReportRateLimiter } from './abuse/redis-report-rate-limiter.js';
import { PostgresBusinessIdentityRepository } from './identity/postgres-business-identity-repository.js';
import { VerifiedBusinessIdentityProvider } from './identity/caller-identity-provider.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;
const hmacSecret = process.env.PHONE_LOOKUP_HMAC_SECRET;
const redisUrl = process.env.REDIS_URL;
const moderationToken = process.env.MODERATION_TOKEN;

const reputationRepository = databaseUrl && hmacSecret
  ? new PostgresReputationRepository(databaseUrl, hmacSecret)
  : undefined;
const reporterRepository = databaseUrl
  ? new PostgresReporterRepository(databaseUrl)
  : undefined;
const correctionRepository = databaseUrl && hmacSecret
  ? new PostgresCorrectionRepository(databaseUrl, hmacSecret)
  : undefined;
const businessIdentityRepository = databaseUrl && hmacSecret
  ? new PostgresBusinessIdentityRepository(databaseUrl, hmacSecret)
  : undefined;
const callerIdentityProvider = businessIdentityRepository
  ? new VerifiedBusinessIdentityProvider(businessIdentityRepository)
  : undefined;
const reportRateLimiter = redisUrl
  ? new RedisReportRateLimiter(redisUrl)
  : undefined;

const app = buildApp({
  reputationRepository,
  reporterRepository,
  correctionRepository,
  businessIdentityRepository,
  callerIdentityProvider,
  reportRateLimiter,
  moderationToken,
});
app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
