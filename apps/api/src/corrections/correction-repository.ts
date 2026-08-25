import { randomUUID } from 'node:crypto';
import type { ReputationSubject } from '../reputation/reputation-repository.js';

export const CORRECTION_KINDS = [
  'incorrect_category',
  'number_reassigned',
  'legitimate_business',
  'other',
] as const;

export type CorrectionKind = (typeof CORRECTION_KINDS)[number];
export type CorrectionStatus = 'pending' | 'accepted' | 'rejected';
export type CorrectionDecision = 'accepted' | 'rejected';

export type CorrectionRequest = {
  id: string;
  reporterId: string;
  phoneNumber: string;
  kind: CorrectionKind;
  reason: string | null;
  status: CorrectionStatus;
  createdAt: Date;
  updatedAt: Date;
};

export interface CorrectionRepository {
  create(subject: ReputationSubject, reporterId: string, kind: CorrectionKind, reason: string | null): Promise<CorrectionRequest>;
  listForReporter(reporterId: string): Promise<CorrectionRequest[]>;
  listByStatus(status: CorrectionStatus): Promise<CorrectionRequest[]>;
  decide(correctionId: string, decision: CorrectionDecision, decidedAt?: Date): Promise<CorrectionRequest | null>;
}

export function isCorrectionKind(value: unknown): value is CorrectionKind {
  return typeof value === 'string' && (CORRECTION_KINDS as readonly string[]).includes(value);
}

export function isCorrectionDecision(value: unknown): value is CorrectionDecision {
  return value === 'accepted' || value === 'rejected';
}

export class InMemoryCorrectionRepository implements CorrectionRepository {
  private readonly requests: CorrectionRequest[] = [];

  async create(
    subject: ReputationSubject,
    reporterId: string,
    kind: CorrectionKind,
    reason: string | null,
  ): Promise<CorrectionRequest> {
    const now = new Date();
    const request: CorrectionRequest = {
      id: randomUUID(),
      reporterId,
      phoneNumber: subject.number,
      kind,
      reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.requests.push(request);
    return { ...request };
  }

  async listForReporter(reporterId: string): Promise<CorrectionRequest[]> {
    return this.requests.filter((request) => request.reporterId === reporterId).map((request) => ({ ...request }));
  }

  async listByStatus(status: CorrectionStatus): Promise<CorrectionRequest[]> {
    return this.requests.filter((request) => request.status === status).map((request) => ({ ...request }));
  }

  async decide(
    correctionId: string,
    decision: CorrectionDecision,
    decidedAt: Date = new Date(),
  ): Promise<CorrectionRequest | null> {
    const request = this.requests.find((candidate) => candidate.id === correctionId && candidate.status === 'pending');
    if (!request) return null;
    request.status = decision;
    request.updatedAt = decidedAt;
    return { ...request };
  }
}
