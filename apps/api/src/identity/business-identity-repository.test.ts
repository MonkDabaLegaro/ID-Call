import { describe, expect, it } from 'vitest';
import {
  InMemoryBusinessIdentityRepository,
} from './business-identity-repository.js';
import {
  CompositeCallerIdentityProvider,
  VerifiedBusinessIdentityProvider,
  type CallerIdentityProvider,
} from './caller-identity-provider.js';

const subject = {
  number: '+56912345678',
  countryCode: '56',
  regionCode: 'CL',
  numberType: 'MOBILE',
};
const now = new Date('2026-08-25T12:00:00Z');

describe('business identity', () => {
  it('does not expose pending claims', async () => {
    const repository = new InMemoryBusinessIdentityRepository(() => now);
    await repository.create(subject, 'reporter-1', {
      displayName: 'Example Business',
      publicWebsite: 'https://example.com',
      publicAddress: null,
    });
    expect(await repository.activeForNumber(subject.number, now)).toEqual([]);
  });

  it('exposes verified claims with controlled confidence and expiry', async () => {
    const repository = new InMemoryBusinessIdentityRepository(() => now);
    const claim = await repository.create(subject, 'reporter-1', {
      displayName: 'Example Business',
      publicWebsite: 'https://example.com',
      publicAddress: 'Public storefront',
    });
    const decided = await repository.decide(claim.id, 'verified', now);
    expect(decided?.confidence).toBe(0.95);
    expect(decided?.expiresAt?.toISOString()).toBe('2027-08-25T12:00:00.000Z');
    expect(await repository.activeForNumber(subject.number, now)).toHaveLength(1);
  });

  it('never exposes rejected or expired claims', async () => {
    const repository = new InMemoryBusinessIdentityRepository(() => now);
    const rejected = await repository.create(subject, 'reporter-1', {
      displayName: 'Rejected Business', publicWebsite: null, publicAddress: null,
    });
    await repository.decide(rejected.id, 'rejected', now);
    expect(await repository.activeForNumber(subject.number, now)).toEqual([]);

    const verified = await repository.create(subject, 'reporter-2', {
      displayName: 'Old Business', publicWebsite: null, publicAddress: null,
    });
    await repository.decide(verified.id, 'verified', now);
    const afterExpiry = new Date('2027-08-26T12:00:00Z');
    expect(await repository.activeForNumber(subject.number, afterExpiry)).toEqual([]);
  });

  it('selects verified and higher-confidence provider candidates deterministically', async () => {
    const weak: CallerIdentityProvider = {
      name: 'weak',
      async lookup() {
        return [{
          displayName: 'Directory Name', identityType: 'public-directory', verification: 'source-verified',
          confidence: 0.7, publicWebsite: null, publicAddress: null, expiresAt: null,
          provider: 'weak', observedAt: now,
        }];
      },
    };
    const repository = new InMemoryBusinessIdentityRepository(() => now);
    const claim = await repository.create(subject, 'reporter-1', {
      displayName: 'Verified Name', publicWebsite: null, publicAddress: null,
    });
    await repository.decide(claim.id, 'verified', now);
    const provider = new CompositeCallerIdentityProvider([
      weak,
      new VerifiedBusinessIdentityProvider(repository),
    ]);
    expect((await provider.lookup(subject.number, now))[0].displayName).toBe('Verified Name');
  });
});
