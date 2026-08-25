import { randomUUID } from 'node:crypto';
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

export type ReporterVote = {
  id: string;
  trust: number;
};

export type StoredReputationReport = {
  id: string;
  reporterId: string;
  category: ReportCategory;
  reporterTrust: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  withdrawnAt: Date | null;
};

export interface ReputationRepository {
  upsert(subject: ReputationSubject, reporter: ReporterVote, category: ReportCategory): Promise<StoredReputationReport>;
  withdraw(reportId: string, reporterId: string): Promise<boolean>;
  list(number: string, now?: Date): Promise<StoredReputationReport[]>;
  prune(now: Date): Promise<number>;
}

const REPORT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export class InMemoryReputationRepository implements ReputationRepository {
  private readonly reports = new Map<string, StoredReputationReport[]>();

  constructor(private readonly nowProvider: () => Date = () => new Date()) {}

  async upsert(
    subject: ReputationSubject,
    reporter: ReporterVote,
    category: ReportCategory,
  ): Promise<StoredReputationReport> {
    const now = this.nowProvider();
    const existing = this.reports.get(subject.number) ?? [];
    const current = existing.find((report) => report.reporterId === reporter.id);
    if (current) {
      current.category = category;
      current.reporterTrust = reporter.trust;
      current.updatedAt = now;
      current.expiresAt = new Date(now.getTime() + REPORT_TTL_MS);
      current.withdrawnAt = null;
      return { ...current };
    }

    const created: StoredReputationReport = {
      id: randomUUID(),
      reporterId: reporter.id,
      category,
      reporterTrust: reporter.trust,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + REPORT_TTL_MS),
      withdrawnAt: null,
    };
    existing.push(created);
    this.reports.set(subject.number, existing);
    return { ...created };
  }

  async withdraw(reportId: string, reporterId: string): Promise<boolean> {
    for (const reports of this.reports.values()) {
      const report = reports.find((candidate) => candidate.id === reportId && candidate.reporterId === reporterId);
      if (report) {
        const now = this.nowProvider();
        report.withdrawnAt = now;
        report.updatedAt = now;
        return true;
      }
    }
    return false;
  }

  async list(number: string, now: Date = this.nowProvider()): Promise<StoredReputationReport[]> {
    return (this.reports.get(number) ?? [])
      .filter((report) => !report.withdrawnAt && report.expiresAt.getTime() > now.getTime())
      .map((report) => ({ ...report }));
  }

  async prune(now: Date): Promise<number> {
    const withdrawnCutoff = now.getTime() - REPORT_TTL_MS;
    let deleted = 0;
    for (const [number, reports] of this.reports.entries()) {
      const kept = reports.filter((report) => {
        const removable = report.expiresAt.getTime() <= now.getTime()
          || (report.withdrawnAt !== null && report.updatedAt.getTime() <= withdrawnCutoff);
        if (removable) deleted += 1;
        return !removable;
      });
      if (kept.length === 0) this.reports.delete(number);
      else this.reports.set(number, kept);
    }
    return deleted;
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
