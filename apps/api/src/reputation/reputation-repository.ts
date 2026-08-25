import type { ReputationEvidence, ReputationResult } from '@id-call/reputation-domain';
import { scoreReputation } from '@id-call/reputation-domain';

export const REPORT_CATEGORIES = [
  'spam',
  'scam',
  'telemarketing',
  'robocall',
  'debt_collection',
  'legitimate_business',
  'other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type ReputationSubject = {
  number: string;
  countryCode: string;
  regionCode: string | null;
  numberType: string | null;
};

export type StoredReputationReport = {
  category: ReportCategory;
  reporterTrust: number;
  createdAt: Date;
};

export interface ReputationRepository {
  add(subject: ReputationSubject, category: ReportCategory): Promise<void>;
  list(number: string): Promise<StoredReputationReport[]>;
}

export class InMemoryReputationRepository implements ReputationRepository {
  private readonly reports = new Map<string, StoredReputationReport[]>();

  async add(subject: ReputationSubject, category: ReportCategory): Promise<void> {
    const existing = this.reports.get(subject.number) ?? [];
    existing.push({ category, reporterTrust: 0.5, createdAt: new Date() });
    this.reports.set(subject.number, existing);
  }

  async list(number: string): Promise<StoredReputationReport[]> {
    return [...(this.reports.get(number) ?? [])];
  }
}

const CATEGORY_WEIGHT: Record<ReportCategory, number> = {
  spam: 0.8,
  scam: 1,
  telemarketing: 0.5,
  robocall: 0.75,
  debt_collection: 0.35,
  legitimate_business: 0,
  other: 0.25,
};

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === 'string' && (REPORT_CATEGORIES as readonly string[]).includes(value);
}

export function scoreStoredReports(reports: StoredReputationReport[]): ReputationResult {
  const evidence: ReputationEvidence[] = reports.map((report) => ({
    weight: CATEGORY_WEIGHT[report.category],
    confidence: report.reporterTrust,
  }));
  return scoreReputation(evidence);
}
