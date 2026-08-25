import { describe, expect, it } from 'vitest';
import { InMemoryReportRateLimiter } from './report-rate-limiter.js';

describe('report mutation rate limits', () => {
  it('limits a reporter to 20 report mutations per hour', async () => {
    const limiter = new InMemoryReportRateLimiter();
    const now = new Date('2026-08-25T12:00:00Z');
    for (let i = 0; i < 20; i++) {
      expect((await limiter.checkReport('r1', `target-${i}`, now)).allowed).toBe(true);
    }
    expect((await limiter.checkReport('r1', 'target-overflow', now)).allowed).toBe(false);
  });

  it('limits a reporter to 5 mutations for one target per 24 hours', async () => {
    const limiter = new InMemoryReportRateLimiter();
    const now = new Date('2026-08-25T12:00:00Z');
    for (let i = 0; i < 5; i++) {
      expect((await limiter.checkReport('r1', 'target-a', now)).allowed).toBe(true);
    }
    expect((await limiter.checkReport('r1', 'target-a', now)).allowed).toBe(false);
    expect((await limiter.checkReport('r1', 'target-b', now)).allowed).toBe(true);
  });

  it('allows a new window after expiry', async () => {
    const limiter = new InMemoryReportRateLimiter();
    const start = new Date('2026-08-25T12:00:00Z');
    for (let i = 0; i < 5; i++) await limiter.checkReport('r1', 'target-a', start);
    expect((await limiter.checkReport('r1', 'target-a', new Date('2026-08-26T12:00:01Z'))).allowed).toBe(true);
  });

  it('limits corrections to 10 per reporter per 24 hours', async () => {
    const limiter = new InMemoryReportRateLimiter();
    const now = new Date('2026-08-25T12:00:00Z');
    for (let i = 0; i < 10; i++) {
      expect((await limiter.checkCorrection('r1', now)).allowed).toBe(true);
    }
    expect((await limiter.checkCorrection('r1', now)).allowed).toBe(false);
  });
});
