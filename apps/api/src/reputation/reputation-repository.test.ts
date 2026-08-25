import { describe, expect, it } from 'vitest';
import {
  InMemoryReputationRepository,
  isReportCategory,
  scoreStoredReports,
  type StoredReputationReport,
} from './reputation-repository.js';

const subject = {
  number: '+56912345678',
  countryCode: '56',
  regionCode: 'CL',
  numberType: 'MOBILE',
};
const reporter = { id: 'reporter-1', trust: 0.25 };
const now = new Date('2026-08-25T12:00:00Z');

function report(
  id: string,
  reporterId: string,
  category: StoredReputationReport['category'],
  trust: number,
  ageDays = 0,
): StoredReputationReport {
  const updatedAt = new Date(now.getTime() - ageDays * 24 * 60 * 60 * 1000);
  return {
    id,
    reporterId,
    category,
    reporterTrust: trust,
    createdAt: updatedAt,
    updatedAt,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    withdrawnAt: null,
  };
}

describe('reputation repository', () => {
  it('starts with unknown reputation', async () => {
    const repository = new InMemoryReputationRepository();
    expect(scoreStoredReports(await repository.list(subject.number))).toEqual({ score: 0, level: 'unknown', reports: 0 });
  });

  it('keeps one active vote per reporter and number', async () => {
    const repository = new InMemoryReputationRepository();
    const first = await repository.upsert(subject, reporter, 'spam');
    const second = await repository.upsert(subject, reporter, 'scam');
    const reports = await repository.list(subject.number);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.report.id).toBe(first.report.id);
    expect(reports).toHaveLength(1);
    expect(reports[0].category).toBe('scam');
  });

  it('excludes expired and withdrawn reports', async () => {
    const repository = new InMemoryReputationRepository(() => now);
    const stored = await repository.upsert(subject, reporter, 'scam');
    expect(await repository.list(subject.number, now)).toHaveLength(1);

    expect(await repository.withdraw(stored.report.id, reporter.id)).toBe(true);
    expect(await repository.list(subject.number, now)).toHaveLength(0);
  });

  it('prevents a different reporter from withdrawing a report', async () => {
    const repository = new InMemoryReputationRepository();
    const stored = await repository.upsert(subject, reporter, 'spam');
    expect(await repository.withdraw(stored.report.id, 'reporter-2')).toBe(false);
  });

  it('keeps one fresh low-trust scam report below high risk', () => {
    const result = scoreStoredReports([report('1', 'r1', 'scam', 0.25)], now);
    expect(result.reports).toBe(1);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(0.75);
    expect(result.level).not.toBe('high');
  });

  it('decays older evidence with a sixty-day half-life', () => {
    const fresh = scoreStoredReports([report('1', 'r1', 'scam', 0.75, 0)], now);
    const aged = scoreStoredReports([report('2', 'r2', 'scam', 0.75, 60)], now);
    expect(aged.score).toBeLessThan(fresh.score);
  });

  it('rewards agreement across independent reporters', () => {
    const agreeing = scoreStoredReports([
      report('1', 'r1', 'scam', 0.75),
      report('2', 'r2', 'scam', 0.75),
      report('3', 'r3', 'scam', 0.75),
    ], now);
    const conflicting = scoreStoredReports([
      report('4', 'r4', 'scam', 0.75),
      report('5', 'r5', 'legitimate_business', 0.75),
      report('6', 'r6', 'telemarketing', 0.75),
    ], now);
    expect(agreeing.score).toBeGreaterThan(conflicting.score);
  });

  it('accepts only controlled report categories', () => {
    expect(isReportCategory('robocall')).toBe(true);
    expect(isReportCategory('stalker')).toBe(false);
  });
});
