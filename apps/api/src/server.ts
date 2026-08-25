import { buildApp } from './app.js';
import { PostgresReputationRepository } from './reputation/postgres-reputation-repository.js';
import { PostgresReporterRepository } from './reporters/postgres-reporter-repository.js';
import { PostgresCorrectionRepository } from './corrections/postgres-correction-repository.js';
import { RedisReportRateLimiter } from './abuse/redis-report-rate-limiter.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;
const hmacSecret = process.env.PHONE_LOOKUP_HMAC_SECRET;
const redisUrl = process.env.REDIS_URL;

const reputationRepository = databaseUrl && hmacSecret
  ? new PostgresReputationRepository(databaseUrl, hmacSecret)
  : undefined;
const reporterRepository = databaseUrl
  ? new PostgresReporterRepository(databaseUrl)
  : undefined;
const correctionRepository = databaseUrl && hmacSecret
  ? new PostgresCorrectionRepository(databaseUrl, hmacSecret)
  : undefined;
const reportRateLimiter = redisUrl
  ? new RedisReportRateLimiter(redisUrl)
  : undefined;

const app = buildApp({
  reputationRepository,
  reporterRepository,
  correctionRepository,
  reportRateLimiter,
});
app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
