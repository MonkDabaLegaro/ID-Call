import type { BusinessIdentityRepository } from './business-identity-repository.js';

export type IdentityCandidate = {
  displayName: string;
  identityType: 'verified-business' | 'public-directory';
  verification: 'verified' | 'source-verified';
  confidence: number;
  publicWebsite: string | null;
  publicAddress: string | null;
  expiresAt: Date | null;
  provider: string;
  observedAt: Date;
};

export interface CallerIdentityProvider {
  readonly name: string;
  lookup(phoneNumber: string, now?: Date): Promise<IdentityCandidate[]>;
}

export class VerifiedBusinessIdentityProvider implements CallerIdentityProvider {
  readonly name = 'verified-business';

  constructor(private readonly repository: BusinessIdentityRepository) {}

  async lookup(phoneNumber: string, now: Date = new Date()): Promise<IdentityCandidate[]> {
    const claims = await this.repository.activeForNumber(phoneNumber, now);
    return claims.map((claim) => ({
      displayName: claim.displayName,
      identityType: 'verified-business',
      verification: 'verified',
      confidence: claim.confidence,
      publicWebsite: claim.publicWebsite,
      publicAddress: claim.publicAddress,
      expiresAt: claim.expiresAt,
      provider: this.name,
      observedAt: claim.moderatedAt ?? claim.updatedAt,
    }));
  }
}

export class CompositeCallerIdentityProvider implements CallerIdentityProvider {
  readonly name = 'composite-identity';

  constructor(private readonly providers: CallerIdentityProvider[]) {}

  async lookup(phoneNumber: string, now: Date = new Date()): Promise<IdentityCandidate[]> {
    const collected: Array<IdentityCandidate & { providerOrder: number }> = [];
    for (let index = 0; index < this.providers.length; index += 1) {
      const provider = this.providers[index];
      for (const candidate of await provider.lookup(phoneNumber, now)) {
        collected.push({ ...candidate, providerOrder: index });
      }
    }
    const rankVerification = (value: IdentityCandidate['verification']) => value === 'verified' ? 2 : 1;
    return collected
      .sort((a, b) => rankVerification(b.verification) - rankVerification(a.verification)
        || b.confidence - a.confidence
        || a.providerOrder - b.providerOrder)
      .map(({ providerOrder: _providerOrder, ...candidate }) => candidate);
  }
}
