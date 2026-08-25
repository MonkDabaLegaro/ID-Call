import type { ReporterRepository, AuthenticatedReporter } from './reporter-repository.js';

export async function authenticateBearer(
  authorizationHeader: string | undefined,
  repository: ReporterRepository,
): Promise<AuthenticatedReporter | null> {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  return repository.authenticate(token);
}
