export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export interface ReportRateLimiter {
  checkReport(reporterId: string, targetKey: string, now?: Date): Promise<RateLimitDecision>;
  checkCorrection(reporterId: string, now?: Date): Promise<RateLimitDecision>;
}

type Bucket = {
  startedAt: number;
  count: number;
};

export class InMemoryReportRateLimiter implements ReportRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  private consume(key: string, limit: number, windowMs: number, now: Date): RateLimitDecision {
    const current = now.getTime();
    const existing = this.buckets.get(key);
    if (!existing || current - existing.startedAt > windowMs) {
      this.buckets.set(key, { startedAt: current, count: 1 });
      return { allowed: true };
    }
    if (existing.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (current - existing.startedAt)) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    existing.count += 1;
    return { allowed: true };
  }

  async checkReport(reporterId: string, targetKey: string, now: Date = new Date()): Promise<RateLimitDecision> {
    const reporterDecision = this.consume(`reporter-hour:${reporterId}`, 20, 60 * 60 * 1000, now);
    if (!reporterDecision.allowed) return reporterDecision;
    return this.consume(`reporter-target-day:${reporterId}:${targetKey}`, 5, 24 * 60 * 60 * 1000, now);
  }

  async checkCorrection(reporterId: string, now: Date = new Date()): Promise<RateLimitDecision> {
    return this.consume(`correction-day:${reporterId}`, 10, 24 * 60 * 60 * 1000, now);
  }
}
