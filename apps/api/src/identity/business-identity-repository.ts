import { randomUUID } from 'node:crypto';
import type { ReputationSubject } from '../reputation/reputation-repository.js';

export type BusinessClaimStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export type BusinessClaimDecision = 'verified' | 'rejected';

export type BusinessClaimInput = {
  displayName: string;
  publicWebsite: string | null;
  publicAddress: string | null;
};

export type BusinessIdentityClaim = {
  id: string;
  reporterId: string;
  phoneNumber: string;
  displayName: string;
  publicWebsite: string | null;
  publicAddress: string | null;
  status: BusinessClaimStatus;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  moderatedAt: Date | null;
  expiresAt: Date | null;
};

export interface BusinessIdentityRepository {
  create(subject: ReputationSubject, reporterId: string, input: BusinessClaimInput): Promise<BusinessIdentityClaim>;
  listByStatus(status: BusinessClaimStatus): Promise<BusinessIdentityClaim[]>;
  decide(claimId: string, decision: BusinessClaimDecision, decidedAt?: Date): Promise<BusinessIdentityClaim | null>;
  activeForNumber(number: string, now?: Date): Promise<BusinessIdentityClaim[]>;
  expire(now: Date): Promise<number>;
}

const VERIFIED_CONFIDENCE = 0.95;
const VERIFIED_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export class InMemoryBusinessIdentityRepository implements BusinessIdentityRepository {
  private readonly claims = new Map<string, BusinessIdentityClaim>();

  constructor(private readonly nowProvider: () => Date = () => new Date()) {}

  async create(subject: ReputationSubject, reporterId: string, input: BusinessClaimInput): Promise<BusinessIdentityClaim> {
    const now = this.nowProvider();
    const claim: BusinessIdentityClaim = {
      id: randomUUID(),
      reporterId,
      phoneNumber: subject.number,
      displayName: input.displayName,
      publicWebsite: input.publicWebsite,
      publicAddress: input.publicAddress,
      status: 'pending',
      confidence: 0,
      createdAt: now,
      updatedAt: now,
      moderatedAt: null,
      expiresAt: null,
    };
    this.claims.set(claim.id, claim);
    return { ...claim };
  }

  async listByStatus(status: BusinessClaimStatus): Promise<BusinessIdentityClaim[]> {
    return [...this.claims.values()].filter((claim) => claim.status === status).map((claim) => ({ ...claim }));
  }

  async decide(
    claimId: string,
    decision: BusinessClaimDecision,
    decidedAt: Date = this.nowProvider(),
  ): Promise<BusinessIdentityClaim | null> {
    const claim = this.claims.get(claimId);
    if (!claim || claim.status !== 'pending') return null;
    claim.status = decision;
    claim.confidence = decision === 'verified' ? VERIFIED_CONFIDENCE : 0;
    claim.moderatedAt = decidedAt;
    claim.updatedAt = decidedAt;
    claim.expiresAt = decision === 'verified' ? new Date(decidedAt.getTime() + VERIFIED_TTL_MS) : null;
    return { ...claim };
  }

  async activeForNumber(number: string, now: Date = this.nowProvider()): Promise<BusinessIdentityClaim[]> {
    return [...this.claims.values()]
      .filter((claim) => claim.phoneNumber === number)
      .filter((claim) => claim.status === 'verified' && claim.expiresAt !== null && claim.expiresAt.getTime() > now.getTime())
      .map((claim) => ({ ...claim }));
  }

  async expire(now: Date): Promise<number> {
    let expired = 0;
    for (const claim of this.claims.values()) {
      if (claim.status === 'verified' && claim.expiresAt && claim.expiresAt.getTime() <= now.getTime()) {
        claim.status = 'expired';
        claim.updatedAt = now;
        expired += 1;
      }
    }
    return expired;
  }
}

export function isBusinessClaimDecision(value: unknown): value is BusinessClaimDecision {
  return value === 'verified' || value === 'rejected';
}
