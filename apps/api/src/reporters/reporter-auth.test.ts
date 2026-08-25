import { describe, expect, it } from 'vitest';
import {
  InMemoryReporterRepository,
  calculateReporterTrust,
} from './reporter-repository.js';

describe('reporter authentication', () => {
  it('returns a raw token once and authenticates it without persisting the raw value', async () => {
    const repository = new InMemoryReporterRepository();

    const credential = await repository.create();
    const reporter = await repository.authenticate(credential.token);

    expect(credential.token.length).toBeGreaterThan(32);
    expect(reporter?.id).toBe(credential.reporterId);
    expect(repository.debugStoredTokenHashes()).not.toContain(credential.token);
  });

  it('rejects an unknown bearer token', async () => {
    const repository = new InMemoryReporterRepository();
    await repository.create();

    expect(await repository.authenticate('not-a-valid-token')).toBeNull();
  });

  it('starts reporter trust at 0.25 and caps it at 0.75', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');

    expect(calculateReporterTrust({
      id: 'reporter-1',
      createdAt,
      acceptedReports: 0,
      disabledAt: null,
    }, createdAt)).toBe(0.25);

    expect(calculateReporterTrust({
      id: 'reporter-1',
      createdAt,
      acceptedReports: 500,
      disabledAt: null,
    }, new Date('2027-01-01T00:00:00Z'))).toBe(0.75);
  });

  it('gives disabled reporters zero effective trust', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    expect(calculateReporterTrust({
      id: 'reporter-1',
      createdAt,
      acceptedReports: 20,
      disabledAt: new Date('2026-02-01T00:00:00Z'),
    }, new Date('2026-03-01T00:00:00Z'))).toBe(0);
  });
});
