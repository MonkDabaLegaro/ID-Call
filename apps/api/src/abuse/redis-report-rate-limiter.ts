import { createClient, type RedisClientType } from 'redis';
import type { RateLimitDecision, ReportRateLimiter } from './report-rate-limiter.js';

export class RedisReportRateLimiter implements ReportRateLimiter {
  private readonly client: RedisClientType;
  private connectionPromise: Promise<void> | null = null;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
  }

  private async connected(): Promise<RedisClientType> {
    if (!this.client.isOpen) {
      this.connectionPromise ??= this.client.connect().then(() => undefined);
      await this.connectionPromise;
    }
    return this.client;
  }

  private async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const client = await this.connected();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    if (count <= limit) return { allowed: true };
    const ttl = await client.ttl(key);
    return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
  }

  async checkReport(reporterId: string, targetKey: string): Promise<RateLimitDecision> {
    const reporterDecision = await this.consume(`reporter-hour:${reporterId}`, 20, 60 * 60);
    if (!reporterDecision.allowed) return reporterDecision;
    return this.consume(`reporter-target-day:${reporterId}:${targetKey}`, 5, 24 * 60 * 60);
  }

  async checkCorrection(reporterId: string): Promise<RateLimitDecision> {
    return this.consume(`correction-day:${reporterId}`, 10, 24 * 60 * 60);
  }
}
