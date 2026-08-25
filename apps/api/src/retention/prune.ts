import { pathToFileURL } from 'node:url';
import { PostgresReputationRepository } from '../reputation/postgres-reputation-repository.js';
import type { ReputationRepository } from '../reputation/reputation-repository.js';

export async function pruneReputation(
  repository: ReputationRepository,
  now: Date = new Date(),
): Promise<number> {
  return repository.prune(now);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const hmacSecret = process.env.PHONE_LOOKUP_HMAC_SECRET;
  if (!databaseUrl || !hmacSecret) {
    throw new Error('DATABASE_URL and PHONE_LOOKUP_HMAC_SECRET are required');
  }
  const repository = new PostgresReputationRepository(databaseUrl, hmacSecret);
  const count = await pruneReputation(repository);
  process.stdout.write(`Pruned ${count} reputation reports\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
