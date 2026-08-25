import { describe, expect, it } from 'vitest';
import {
  InMemoryReputationRepository,
  isReportCategory,
  scoreStoredReports,
} from './reputation-repository.js';

const subject = {
  number: '+56912345678',
  countryCode: '56',
  regionCode: 'CL',
  numberType: 'MOBILE',
};
const reporter = { id: 'reporter-1', trust: 0.25 };

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
    const now = new Date('2026-08-25T12:00:00Z');
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

  it('scores submitted scam reports as risk evidence', async () => {
    const repository = new InMemoryReputationRepository();
    await repository.upsert(subject, { id: 'r1', trust: 0.5 }, 'scam');
    const result = scoreStoredReports(await repository.list(subject.number));
    expect(result.reports).toBe(1);
    expect(result.score).toBe(0.5);
    expect(result.level).toBe('medium');
  });

  it('accepts only controlled report categories', () => {
    expect(isReportCategory('robocall')).toBe(true);
    expect(isReportCategory('stalker')).toBe(false);
  });
});
