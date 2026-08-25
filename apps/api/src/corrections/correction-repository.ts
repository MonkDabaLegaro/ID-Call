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

export type CorrectionRequest = {
  id: string;
  reporterId: string;
  phoneNumber: string;
  kind: CorrectionKind;
  reason: string | null;
  status: CorrectionStatus;
  createdAt: Date;
};

export interface CorrectionRepository {
  create(subject: ReputationSubject, reporterId: string, kind: CorrectionKind, reason: string | null): Promise<CorrectionRequest>;
  listForReporter(reporterId: string): Promise<CorrectionRequest[]>;
}

export function isCorrectionKind(value: unknown): value is CorrectionKind {
  return typeof value === 'string' && (CORRECTION_KINDS as readonly string[]).includes(value);
}

export class InMemoryCorrectionRepository implements CorrectionRepository {
  private readonly requests: CorrectionRequest[] = [];

  async create(
    subject: ReputationSubject,
    reporterId: string,
    kind: CorrectionKind,
    reason: string | null,
  ): Promise<CorrectionRequest> {
    const request: CorrectionRequest = {
      id: randomUUID(),
      reporterId,
      phoneNumber: subject.number,
      kind,
      reason,
      status: 'pending',
      createdAt: new Date(),
    };
    this.requests.push(request);
    return { ...request };
  }

  async listForReporter(reporterId: string): Promise<CorrectionRequest[]> {
    return this.requests.filter((request) => request.reporterId === reporterId).map((request) => ({ ...request }));
  }
}
