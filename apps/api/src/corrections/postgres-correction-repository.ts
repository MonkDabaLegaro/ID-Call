import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import type { ReputationSubject } from '../reputation/reputation-repository.js';
import type {
  CorrectionDecision,
  CorrectionKind,
  CorrectionRepository,
  CorrectionRequest,
  CorrectionStatus,
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

  private map(row: any): CorrectionRequest {
    return {
      id: row.id,
      reporterId: row.reporter_id,
      phoneNumber: row.phone_number ?? `[hmac:${row.phone_hmac}]`,
      kind: row.kind,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(
    subject: ReputationSubject,
    reporterId: string,
    kind: CorrectionKind,
    reason: string | null,
  ): Promise<CorrectionRequest> {
    const phoneId = await this.ensurePhone(subject);
    const result = await this.pool.query(
      `INSERT INTO correction_requests (phone_number_id, reporter_id, kind, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reporter_id, $5::text AS phone_number, kind, reason, status, created_at, updated_at`,
      [phoneId, reporterId, kind, reason, subject.number],
    );
    return this.map(result.rows[0]);
  }

  async listForReporter(reporterId: string): Promise<CorrectionRequest[]> {
    const result = await this.pool.query(
      `SELECT cr.id, cr.reporter_id, cr.kind, cr.reason, cr.status, cr.created_at, cr.updated_at, pn.phone_hmac
       FROM correction_requests cr
       JOIN phone_numbers pn ON pn.id = cr.phone_number_id
       WHERE cr.reporter_id = $1
       ORDER BY cr.created_at DESC`,
      [reporterId],
    );
    return result.rows.map((row) => this.map(row));
  }

  async listByStatus(status: CorrectionStatus): Promise<CorrectionRequest[]> {
    const result = await this.pool.query(
      `SELECT cr.id, cr.reporter_id, cr.kind, cr.reason, cr.status, cr.created_at, cr.updated_at, pn.phone_hmac
       FROM correction_requests cr
       JOIN phone_numbers pn ON pn.id = cr.phone_number_id
       WHERE cr.status = $1
       ORDER BY cr.created_at ASC`,
      [status],
    );
    return result.rows.map((row) => this.map(row));
  }

  async decide(
    correctionId: string,
    decision: CorrectionDecision,
    decidedAt: Date = new Date(),
  ): Promise<CorrectionRequest | null> {
    const result = await this.pool.query(
      `UPDATE correction_requests
       SET status = $2, updated_at = $3
       WHERE id = $1 AND status = 'pending'
       RETURNING id, reporter_id, ''::text AS phone_number, kind, reason, status, created_at, updated_at`,
      [correctionId, decision, decidedAt],
    );
    return result.rowCount ? this.map(result.rows[0]) : null;
  }
}
