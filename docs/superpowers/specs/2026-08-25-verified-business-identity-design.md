# Verified Business Identity and Moderation Design

## Goal

Add evidence-backed business identity to ID-Call without weakening the existing privacy boundary or local-first caller-screening path. Lookup results may surface a verified public business name and public business metadata when a claim has been explicitly reviewed, while community reputation gains temporal decay and agreement-aware scoring.

## Product boundary

A phone number is not treated as a permanent person identifier. This stage supports only business identity claims backed by public evidence and an explicit moderation state. It does not add private-person lookup, residential-address discovery, live GPS, contact harvesting, device fingerprinting, or people-search providers.

Verified business identity is a claim with provenance, confidence, observed time, and expiration. Verification means ID-Call reviewed the submitted public evidence; it does not guarantee that every future call from that number is legitimate or that the number can never be reassigned.

## Identity model

A lookup may contain:

```ts
type CallerIdentity = {
  displayName: string;
  identityType: 'verified-business' | 'public-directory';
  verification: 'verified' | 'source-verified';
  confidence: number;
  publicWebsite: string | null;
  publicAddress: string | null;
  expiresAt: string | null;
};
```

Identity is nullable. Missing identity must never be replaced with inferred person information.

## Provider chain

Identity lookup is independent from numbering metadata. The API adds:

```ts
interface CallerIdentityProvider {
  readonly name: string;
  lookup(phoneNumber: string, now?: Date): Promise<IdentityCandidate[]>;
}
```

Initial providers:

- `VerifiedBusinessIdentityProvider`: reads reviewed, unexpired business claims from the repository.
- future public-directory providers may implement the same interface but are not connected in this stage.

`CompositeCallerIdentityProvider` queries configured providers and selects deterministically by:

1. verified/source-verified status,
2. confidence,
3. provider order.

All returned candidate evidence is retained in `sources`; the selected candidate becomes `identity`.

## Business claim workflow

Authenticated pseudonymous reporters may submit a public business claim:

```http
POST /v1/business-claims
Authorization: Bearer <reporter-token>
```

Body:

```json
{
  "phoneNumber": "+56912345678",
  "displayName": "Example Business",
  "publicWebsite": "https://example.com",
  "publicAddress": "Public storefront address, optional"
}
```

Constraints:

- display name: 2–120 characters
- website: HTTPS only, maximum 300 characters
- public address: optional, maximum 300 characters
- claim starts `pending`
- reporter cannot set confidence, verification status, or expiry
- submission rate uses the existing correction/mutation limiter class rather than IP persistence

Claim statuses:

- `pending`
- `verified`
- `rejected`
- `expired`

A verified claim receives a server-controlled confidence of `0.95` and expires after 365 days. Rejected/expired claims never appear in public lookup.

## Moderation boundary

Moderation is an internal service capability, not an Android end-user role. Runtime configuration may provide `MODERATION_TOKEN`.

Internal endpoints:

```http
GET   /v1/moderation/business-claims?status=pending
PATCH /v1/moderation/business-claims/:claimId
GET   /v1/moderation/corrections?status=pending
PATCH /v1/moderation/corrections/:correctionId
```

They require `Authorization: Bearer <MODERATION_TOKEN>` and return `401 MODERATOR_AUTH_REQUIRED` when unavailable or invalid.

Moderation decisions are `verified`/`rejected` for business claims and `accepted`/`rejected` for corrections. Accepting a correction records the moderation outcome only; it does not automatically rewrite reputation or identity. This prevents a correction request from becoming an unreviewed data mutation.

## Repository evolution

`BusinessIdentityRepository` supports:

- create pending claim
- list claims for moderation
- decide claim
- list active verified claims by number
- expire stale claims

`CorrectionRepository` gains:

- list by moderation status
- decide pending request

PostgreSQL migration `003_verified_business_identity.sql` evolves the existing `identity_claims` and `identity_evidence` tables rather than creating a parallel identity system. It adds claim status, claimant reporter, public website/address, updated time, moderation time, and moderation indexes.

## Reputation quality

Report TTL remains 180 days. Scoring now uses each report's `updatedAt` and reporter trust.

Temporal decay uses a 60-day half-life:

```text
decay(ageDays) = 0.5 ^ (ageDays / 60)
```

For active reports:

```text
effectiveWeight = reporterTrust * decay
baseRisk = sum(categoryRisk * effectiveWeight) / sum(effectiveWeight)
agreement = largest category effectiveWeight / sum(effectiveWeight)
volumeConfidence = min(1, sum(effectiveWeight) / 2)
finalRisk = baseRisk
          * (0.5 + 0.5 * agreement)
          * (0.5 + 0.5 * volumeConfidence)
```

This prevents one fresh low-trust report from immediately producing a maximum-risk score, reduces the influence of stale evidence, and rewards category agreement without claiming crowd consensus is ground truth.

Risk category weights remain bounded in `[0,1]`. `legitimate_business` remains zero-risk behavioral evidence; verified business identity is displayed independently from reputation so identity verification does not erase spam/scam reports.

## Lookup contract

`LookupResponse` gains nullable `identity`. `sources` includes identity evidence in addition to number metadata.

Example:

```json
{
  "identity": {
    "displayName": "Example Business",
    "identityType": "verified-business",
    "verification": "verified",
    "confidence": 0.95,
    "publicWebsite": "https://example.com",
    "publicAddress": "Public storefront address",
    "expiresAt": "2027-08-25T12:00:00.000Z"
  }
}
```

## Android

Android stores verified identity fields inside the existing lookup cache so the same identity can be surfaced during local screening without network I/O.

Room schema moves from v2 to v3 with nullable columns on `lookup_records`:

- `identityDisplayName`
- `identityType`
- `identityVerification`
- `identityConfidence`
- `identityPublicWebsite`
- `identityPublicAddress`
- `identityExpiresAtEpochMs`

`LookupRecord.displayLabel` prefers an unexpired verified identity display name, then numbering location/region, then the raw number.

Manual lookup UI shows a dedicated business identity section with verification state, confidence, website/address when present, and the existing evidence list.

`platform/screening` remains network-free and consumes only cached `LookupRecord`; therefore a verified business label can be shown by the existing local notification path without adding a new Telecom/network dependency.

## Error contract

- invalid business claim → `400 INVALID_BUSINESS_CLAIM`
- reporter auth missing/invalid → `401 REPORTER_AUTH_REQUIRED`
- moderator auth missing/invalid → `401 MODERATOR_AUTH_REQUIRED`
- unknown claim/correction → `404 MODERATION_ITEM_NOT_FOUND`
- invalid moderation decision → `400 INVALID_MODERATION_DECISION`
- mutation throttled → `429 REPORT_RATE_LIMITED`

## Non-goals

This stage does not add external commercial people-search vendors, automated business ownership proof, moderator web UI, social login, email accounts, automatic correction side effects, caller-screen replacement overlays, call blocking based solely on community score, or precise physical tracking.