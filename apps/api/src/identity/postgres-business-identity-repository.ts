import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import type { ReputationSubject } from '../reputation/reputation-repository.js';
import type {
  BusinessClaimDecision,
  BusinessClaimInput,
  BusinessClaimStatus,
  BusinessIdentityClaim,
  BusinessIdentityRepository,
} from './business-identity-repository.js';

export class PostgresBusinessIdentityRepository implements BusinessIdentityRepository {
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

  private map(row: any): BusinessIdentityClaim {
    return {
      id: row.id,
      reporterId: row.reporter_id,
      phoneNumber: row.phone_number,
      displayName: row.display_name,
      publicWebsite: row.public_website,
      publicAddress: row.public_address,
      status: row.status,
      confidence: Number(row.confidence),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      moderatedAt: row.moderated_at,
      expiresAt: row.expires_at,
    };
  }

  async create(subject: ReputationSubject, reporterId: string, input: BusinessClaimInput): Promise<BusinessIdentityClaim> {
    const phoneId = await this.ensurePhone(subject);
    const result = await this.pool.query(
      `INSERT INTO identity_claims
        (phone_number_id, reporter_id, display_name, identity_type, confidence, status, public_website, public_address)
       VALUES ($1, $2, $3, 'verified-business', 0, 'pending', $4, $5)
       RETURNING id, reporter_id, $6::text AS phone_number, display_name, public_website, public_address,
                 status, confidence, created_at, updated_at, moderated_at, expires_at`,
      [phoneId, reporterId, input.displayName, input.publicWebsite, input.publicAddress, subject.number],
    );
    return this.map(result.rows[0]);
  }

  async listByStatus(status: BusinessClaimStatus): Promise<BusinessIdentityClaim[]> {
    const result = await this.pool.query(
      `SELECT ic.id, ic.reporter_id, ic.display_name, ic.public_website, ic.public_address,
              ic.status, ic.confidence, ic.created_at, ic.updated_at, ic.moderated_at, ic.expires_at,
              ''::text AS phone_number
       FROM identity_claims ic
       WHERE ic.identity_type = 'verified-business' AND ic.status = $1
       ORDER BY ic.created_at ASC`,
      [status],
    );
    return result.rows.map((row) => this.map(row));
  }

  async decide(claimId: string, decision: BusinessClaimDecision, decidedAt: Date = new Date()): Promise<BusinessIdentityClaim | null> {
    const result = await this.pool.query(
      `UPDATE identity_claims
       SET status = $2,
           confidence = CASE WHEN $2 = 'verified' THEN 0.95 ELSE 0 END,
           moderated_at = $3,
           updated_at = $3,
           expires_at = CASE WHEN $2 = 'verified' THEN $3 + interval '365 days' ELSE NULL END
       WHERE id = $1 AND identity_type = 'verified-business' AND status = 'pending'
       RETURNING id, reporter_id, ''::text AS phone_number, display_name, public_website, public_address,
                 status, confidence, created_at, updated_at, moderated_at, expires_at`,
      [claimId, decision, decidedAt],
    );
    return result.rowCount ? this.map(result.rows[0]) : null;
  }

  async activeForNumber(number: string, now: Date = new Date()): Promise<BusinessIdentityClaim[]> {
    const result = await this.pool.query(
      `SELECT ic.id, ic.reporter_id, $2::text AS phone_number, ic.display_name, ic.public_website, ic.public_address,
              ic.status, ic.confidence, ic.created_at, ic.updated_at, ic.moderated_at, ic.expires_at
       FROM identity_claims ic
       JOIN phone_numbers pn ON pn.id = ic.phone_number_id
       WHERE pn.phone_hmac = $1
         AND ic.identity_type = 'verified-business'
         AND ic.status = 'verified'
         AND ic.expires_at > $3
       ORDER BY ic.confidence DESC, ic.moderated_at DESC`,
      [this.phoneHmac(number), number, now],
    );
    return result.rows.map((row) => this.map(row));
  }

  async expire(now: Date): Promise<number> {
    const result = await this.pool.query(
      `UPDATE identity_claims
       SET status = 'expired', updated_at = $1
       WHERE identity_type = 'verified-business' AND status = 'verified' AND expires_at <= $1`,
      [now],
    );
    return result.rowCount ?? 0;
  }
}
