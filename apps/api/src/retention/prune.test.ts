import { describe, expect, it } from 'vitest';
import { InMemoryReputationRepository } from '../reputation/reputation-repository.js';
import { pruneReputation } from './prune.js';

const subject = {
  number: '+56912345678',
  countryCode: '56',
  regionCode: 'CL',
  numberType: 'MOBILE',
};

describe('reputation retention', () => {
  it('removes expired reports and leaves active reports', async () => {
    let now = new Date('2026-01-01T00:00:00Z');
    const repository = new InMemoryReputationRepository(() => now);
    await repository.upsert(subject, { id: 'old', trust: 0.25 }, 'spam');

    now = new Date('2026-07-01T00:00:01Z');
    await repository.upsert(subject, { id: 'active', trust: 0.25 }, 'scam');

    const deleted = await pruneReputation(repository, now);

    expect(deleted).toBe(1);
    expect((await repository.list(subject.number, now)).map((report) => report.reporterId)).toEqual(['active']);
  });
});
