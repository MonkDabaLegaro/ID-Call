import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import type {
  ReportCategory,
  ReputationRepository,
  ReputationSubject,
  ReporterVote,
  StoredReputationReport,
} from './reputation-repository.js';

export class PostgresReputationRepository implements ReputationRepository {
  private readonly pool: Pool;

  constructor(connectionString: string, private readonly hmacSecret: string) {
    if (hmacSecret.length < 32) throw new Error('PHONE_LOOKUP_HMAC_SECRET must be at least 32 characters');
    this.pool = new Pool({ connectionString });
  }

  private phoneHmac(number: string): string {
    return createHmac('sha256', this.hmacSecret).update(number).digest('hex');
  }

  private async ensurePhone(subject: ReputationSubject): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO phone_numbers (phone_hmac, country_code, region_code, number_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (phone_hmac) DO UPDATE SET
         country_code = EXCLUDED.country_code,
         region_code = EXCLUDED.region_code,
         number_type = EXCLUDED.number_type,
         updated_at = now()
       RETURNING id`,
      [this.phoneHmac(subject.number), subject.countryCode, subject.regionCode, subject.numberType],
    );
    return result.rows[0].id;
  }

  async upsert(subject: ReputationSubject, reporter: ReporterVote, category: ReportCategory): Promise<StoredReputationReport> {
    const phoneId = await this.ensurePhone(subject);
    const result = await this.pool.query<{
      id: string;
      reporter_id: string;
      category: ReportCategory;
      reporter_trust: string;
      created_at: Date;
      updated_at: Date;
      expires_at: Date;
      withdrawn_at: Date | null;
    }>(
      `INSERT INTO reputation_reports
         (phone_number_id, reporter_id, category, reporter_trust, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '180 days')
       ON CONFLICT (phone_number_id, reporter_id) WHERE reporter_id IS NOT NULL
       DO UPDATE SET
         category = EXCLUDED.category,
         reporter_trust = EXCLUDED.reporter_trust,
         updated_at = now(),
         expires_at = now() + interval '180 days',
         withdrawn_at = NULL
       RETURNING id, reporter_id, category, reporter_trust, created_at, updated_at, expires_at, withdrawn_at`,
      [phoneId, reporter.id, category, reporter.trust],
    );
    const row = result.rows[0];
    return {
      id: row.id,
      reporterId: row.reporter_id,
      category: row.category,
      reporterTrust: Number(row.reporter_trust),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      withdrawnAt: row.withdrawn_at,
    };
  }

  async withdraw(reportId: string, reporterId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE reputation_reports
       SET withdrawn_at = now(), updated_at = now()
       WHERE id = $1 AND reporter_id = $2 AND withdrawn_at IS NULL`,
      [reportId, reporterId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(number: string, now: Date = new Date()): Promise<StoredReputationReport[]> {
    const result = await this.pool.query<{
      id: string;
      reporter_id: string | null;
      category: ReportCategory;
      reporter_trust: string;
      created_at: Date;
      updated_at: Date;
      expires_at: Date;
      withdrawn_at: Date | null;
    }>(
      `SELECT rr.id, rr.reporter_id, rr.category, rr.reporter_trust,
              rr.created_at, rr.updated_at, rr.expires_at, rr.withdrawn_at
       FROM reputation_reports rr
       JOIN phone_numbers pn ON pn.id = rr.phone_number_id
       WHERE pn.phone_hmac = $1
         AND rr.withdrawn_at IS NULL
         AND rr.expires_at > $2
       ORDER BY rr.updated_at DESC`,
      [this.phoneHmac(number), now],
    );
    return result.rows.map((row) => ({
      id: row.id,
      reporterId: row.reporter_id ?? 'legacy',
      category: row.category,
      reporterTrust: Number(row.reporter_trust),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      withdrawnAt: row.withdrawn_at,
    }));
  }

  async prune(now: Date): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM reputation_reports
       WHERE expires_at <= $1
          OR (withdrawn_at IS NOT NULL AND updated_at <= $1 - interval '180 days')`,
      [now],
    );
    return result.rowCount ?? 0;
  }
}
