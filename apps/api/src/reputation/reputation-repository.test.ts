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

describe('reputation repository', () => {
  it('starts with unknown reputation', async () => {
    const repository = new InMemoryReputationRepository();
    expect(scoreStoredReports(await repository.list(subject.number))).toEqual({ score: 0, level: 'unknown', reports: 0 });
  });

  it('scores submitted scam reports as risk evidence', async () => {
    const repository = new InMemoryReputationRepository();
    await repository.add(subject, 'scam');
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
