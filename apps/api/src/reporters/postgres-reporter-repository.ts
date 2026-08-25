import { Pool } from 'pg';
import {
  createReporterToken,
  hashReporterToken,
  type AuthenticatedReporter,
  type ReporterCredential,
  type ReporterRepository,
} from './reporter-repository.js';

export class PostgresReporterRepository implements ReporterRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async create(): Promise<ReporterCredential> {
    const token = createReporterToken();
    const result = await this.pool.query<{ id: string }>(
      'INSERT INTO reporters (token_hash) VALUES ($1) RETURNING id',
      [hashReporterToken(token)],
    );
    return { reporterId: result.rows[0].id, token };
  }

  async authenticate(rawToken: string): Promise<AuthenticatedReporter | null> {
    const result = await this.pool.query<{ id: string; created_at: Date; accepted_reports: number; disabled_at: Date | null }>(
      'SELECT id, created_at, accepted_reports, disabled_at FROM reporters WHERE token_hash = $1 AND disabled_at IS NULL',
      [hashReporterToken(rawToken)],
    );
    const row = result.rows[0];
    return row ? {
      id: row.id,
      createdAt: row.created_at,
      acceptedReports: row.accepted_reports,
      disabledAt: row.disabled_at,
    } : null;
  }

  async incrementAcceptedReports(reporterId: string): Promise<void> {
    await this.pool.query(
      'UPDATE reporters SET accepted_reports = accepted_reports + 1, updated_at = now() WHERE id = $1',
      [reporterId],
    );
  }
}
