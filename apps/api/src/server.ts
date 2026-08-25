import { buildApp } from './app.js';
import { PostgresReputationRepository } from './reputation/postgres-reputation-repository.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;
const hmacSecret = process.env.PHONE_HMAC_SECRET;

const reputationRepository = databaseUrl && hmacSecret
  ? new PostgresReputationRepository(databaseUrl, hmacSecret)
  : undefined;

const app = buildApp({ reputationRepository });
app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
