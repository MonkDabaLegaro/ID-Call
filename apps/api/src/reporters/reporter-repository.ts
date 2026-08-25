import { createHash, randomBytes, randomUUID } from 'node:crypto';

export type ReporterCredential = {
  reporterId: string;
  token: string;
};

export type AuthenticatedReporter = {
  id: string;
  createdAt: Date;
  acceptedReports: number;
  disabledAt: Date | null;
};

export interface ReporterRepository {
  create(): Promise<ReporterCredential>;
  authenticate(rawToken: string): Promise<AuthenticatedReporter | null>;
  incrementAcceptedReports(reporterId: string): Promise<void>;
}

export function hashReporterToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function calculateReporterTrust(
  reporter: AuthenticatedReporter,
  now: Date = new Date(),
): number {
  if (reporter.disabledAt) return 0;
  const ageMs = Math.max(0, now.getTime() - reporter.createdAt.getTime());
  const ageDays = ageMs / 86_400_000;
  const tenureContribution = Math.min(0.25, (ageDays / 180) * 0.25);
  const participationContribution = Math.min(0.25, (reporter.acceptedReports / 50) * 0.25);
  return Math.min(0.75, Number((0.25 + tenureContribution + participationContribution).toFixed(6)));
}

type StoredReporter = AuthenticatedReporter & { tokenHash: string };

export class InMemoryReporterRepository implements ReporterRepository {
  private readonly reporters = new Map<string, StoredReporter>();

  async create(): Promise<ReporterCredential> {
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    this.reporters.set(id, {
      id,
      tokenHash: hashReporterToken(token),
      createdAt: new Date(),
      acceptedReports: 0,
      disabledAt: null,
    });
    return { reporterId: id, token };
  }

  async authenticate(rawToken: string): Promise<AuthenticatedReporter | null> {
    const tokenHash = hashReporterToken(rawToken);
    const reporter = [...this.reporters.values()].find((candidate) => candidate.tokenHash === tokenHash);
    if (!reporter || reporter.disabledAt) return null;
    return {
      id: reporter.id,
      createdAt: reporter.createdAt,
      acceptedReports: reporter.acceptedReports,
      disabledAt: reporter.disabledAt,
    };
  }

  async incrementAcceptedReports(reporterId: string): Promise<void> {
    const reporter = this.reporters.get(reporterId);
    if (reporter) reporter.acceptedReports += 1;
  }

  debugStoredTokenHashes(): string[] {
    return [...this.reporters.values()].map((reporter) => reporter.tokenHash);
  }
}
