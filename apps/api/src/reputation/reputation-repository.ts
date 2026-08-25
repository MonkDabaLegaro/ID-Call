import { randomUUID } from 'node:crypto';
import type { ReputationLevel, ReputationResult } from '@id-call/reputation-domain';

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

export type UpsertReputationResult = {
  report: StoredReputationReport;
  created: boolean;
};

export interface ReputationRepository {
  upsert(subject: ReputationSubject, reporter: ReporterVote, category: ReportCategory): Promise<UpsertReputationResult>;
  withdraw(reportId: string, reporterId: string): Promise<boolean>;
  list(number: string, now?: Date): Promise<StoredReputationReport[]>;
  prune(now: Date): Promise<number>;
}

const REPORT_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const DECAY_HALF_LIFE_MS = 60 * 24 * 60 * 60 * 1000;

export class InMemoryReputationRepository implements ReputationRepository {
  private readonly reports = new Map<string, StoredReputationReport[]>();

  constructor(private readonly nowProvider: () => Date = () => new Date()) {}

  async upsert(
    subject: ReputationSubject,
    reporter: ReporterVote,
    category: ReportCategory,
  ): Promise<UpsertReputationResult> {
    const now = this.nowProvider();
    const existing = this.reports.get(subject.number) ?? [];
    const current = existing.find((report) => report.reporterId === reporter.id);
    if (current) {
      current.category = category;
      current.reporterTrust = reporter.trust;
      current.updatedAt = now;
      current.expiresAt = new Date(now.getTime() + REPORT_TTL_MS);
      current.withdrawnAt = null;
      return { report: { ...current }, created: false };
    }

    const createdReport: StoredReputationReport = {
      id: randomUUID(),
      reporterId: reporter.id,
      category,
      reporterTrust: reporter.trust,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + REPORT_TTL_MS),
      withdrawnAt: null,
    };
    existing.push(createdReport);
    this.reports.set(subject.number, existing);
    return { report: { ...createdReport }, created: true };
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

function temporalDecay(updatedAt: Date, now: Date): number {
  const ageMs = Math.max(0, now.getTime() - updatedAt.getTime());
  return Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS);
}

function levelFor(score: number): ReputationLevel {
  return score >= 0.75 ? 'high' : score >= 0.4 ? 'medium' : 'low';
}

export function scoreStoredReports(
  reports: StoredReputationReport[],
  now: Date = new Date(),
): ReputationResult {
  if (reports.length === 0) return { score: 0, level: 'unknown', reports: 0 };

  const weighted = reports.map((report) => {
    const effectiveWeight = Math.max(0, Math.min(1, report.reporterTrust)) * temporalDecay(report.updatedAt, now);
    return {
      category: report.category,
      risk: CATEGORY_WEIGHT[report.category],
      effectiveWeight,
    };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.effectiveWeight, 0);
  if (totalWeight <= 0) return { score: 0, level: 'low', reports: reports.length };

  const baseRisk = weighted.reduce((sum, item) => sum + item.risk * item.effectiveWeight, 0) / totalWeight;
  const byCategory = new Map<ReportCategory, number>();
  for (const item of weighted) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.effectiveWeight);
  }
  const largestCategoryWeight = Math.max(...byCategory.values());
  const agreement = largestCategoryWeight / totalWeight;
  const volumeConfidence = Math.min(1, totalWeight / 2);
  const score = Math.max(0, Math.min(
    1,
    baseRisk * (0.5 + 0.5 * agreement) * (0.5 + 0.5 * volumeConfidence),
  ));

  return { score, level: levelFor(score), reports: reports.length };
}
