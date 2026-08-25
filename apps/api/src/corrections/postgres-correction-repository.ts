import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import type { ReputationSubject } from '../reputation/reputation-repository.js';
import type {
  CorrectionKind,
  CorrectionRepository,
  CorrectionRequest,
} from './correction-repository.js';

export class PostgresCorrectionRepository implements CorrectionRepository {
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

  async create(
    subject: ReputationSubject,
    reporterId: string,
    kind: CorrectionKind,
    reason: string | null,
  ): Promise<CorrectionRequest> {
    const phoneId = await this.ensurePhone(subject);
    const result = await this.pool.query<{
      id: string;
      status: 'pending';
      created_at: Date;
    }>(
      `INSERT INTO correction_requests (phone_number_id, reporter_id, kind, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, created_at`,
      [phoneId, reporterId, kind, reason],
    );
    const row = result.rows[0];
    return {
      id: row.id,
      reporterId,
      phoneNumber: subject.number,
      kind,
      reason,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async listForReporter(reporterId: string): Promise<CorrectionRequest[]> {
    const result = await this.pool.query<{
      id: string;
      kind: CorrectionKind;
      reason: string | null;
      status: 'pending' | 'accepted' | 'rejected';
      created_at: Date;
      phone_hmac: string;
    }>(
      `SELECT cr.id, cr.kind, cr.reason, cr.status, cr.created_at, pn.phone_hmac
       FROM correction_requests cr
       JOIN phone_numbers pn ON pn.id = cr.phone_number_id
       WHERE cr.reporter_id = $1
       ORDER BY cr.created_at DESC`,
      [reporterId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      reporterId,
      phoneNumber: `[hmac:${row.phone_hmac}]`,
      kind: row.kind,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
    }));
  }
}
