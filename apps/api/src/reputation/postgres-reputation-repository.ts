import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import type {
  ReportCategory,
  ReputationRepository,
  ReputationSubject,
  StoredReputationReport,
} from './reputation-repository.js';

export class PostgresReputationRepository implements ReputationRepository {
  private readonly pool: Pool;

  constructor(connectionString: string, private readonly hmacSecret: string) {
    if (hmacSecret.length < 32) throw new Error('PHONE_HMAC_SECRET must be at least 32 characters');
    this.pool = new Pool({ connectionString });
  }

  private phoneHmac(number: string): string {
    return createHmac('sha256', this.hmacSecret).update(number).digest('hex');
  }

  async add(subject: ReputationSubject, category: ReportCategory): Promise<void> {
    const phoneHmac = this.phoneHmac(subject.number);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const phone = await client.query<{ id: string }>(
        `INSERT INTO phone_numbers (phone_hmac, country_code, region_code, number_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone_hmac) DO UPDATE SET
           country_code = EXCLUDED.country_code,
           region_code = EXCLUDED.region_code,
           number_type = EXCLUDED.number_type,
           updated_at = now()
         RETURNING id`,
        [phoneHmac, subject.countryCode, subject.regionCode, subject.numberType],
      );
      await client.query(
        `INSERT INTO reputation_reports (phone_number_id, category, reporter_trust)
         VALUES ($1, $2, $3)`,
        [phone.rows[0].id, category, 0.5],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(number: string): Promise<StoredReputationReport[]> {
    const result = await this.pool.query<{
      category: ReportCategory;
      reporter_trust: string;
      created_at: Date;
    }>(
      `SELECT rr.category, rr.reporter_trust, rr.created_at
       FROM reputation_reports rr
       JOIN phone_numbers pn ON pn.id = rr.phone_number_id
       WHERE pn.phone_hmac = $1
       ORDER BY rr.created_at DESC`,
      [this.phoneHmac(number)],
    );
    return result.rows.map((row) => ({
      category: row.category,
      reporterTrust: Number(row.reporter_trust),
      createdAt: row.created_at,
    }));
  }
}
