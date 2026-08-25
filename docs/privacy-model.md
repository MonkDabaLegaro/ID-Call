# Privacy Model

ID-Call distinguishes numbering metadata from physical-person location, verified public-business claims from person identity, and installation authentication from human identity.

## Allowed data
- E.164 normalization and validity.
- Country/numbering-region metadata.
- Number type where available.
- Reviewed public business identity claims with explicit evidence, confidence and expiry.
- Optional HTTPS business website and explicitly public business address submitted for moderation.
- Community reputation reports and aggregates.
- A pseudonymous reporter UUID and hash of an opaque installation token.
- Pending correction requests needed to challenge reputation data.

## Verified business identity
A verified-business label means ID-Call reviewed public business evidence associated with the number. It is not proof that every future call is legitimate, that the number cannot be reassigned, or that a particular private person owns the number.

Business claims begin pending. Reporters cannot choose confidence, verification status or expiry. Verified claims receive server-controlled confidence `0.95` and expire after 365 days. Pending, rejected and expired claims are excluded from public lookup.

Public business identity remains separate from reputation: a verified business may still accumulate spam/scam behavior reports, and a `legitimate_business` community report cannot create verified identity.

## Reporter privacy
Reporter registration does not require or accept a name, email, contact list, device phone number, advertising identifier, GPS coordinate, residential address, or caller-supplied trust score. The bearer token is returned to the Android installation and persistent server storage keeps only a SHA-256 hash.

Reporter authentication proves possession of that installation token. It is not identity verification and must not be presented as evidence that the reporter is a particular person.

Rate-limit storage is keyed by reporter UUID and a hashed target key. Raw target telephone numbers are not Redis rate-limit keys.

## Explicitly not inferred
- Live device GPS position from a phone number.
- Private residential address from a phone number.
- Hidden/private personal profiles obtained through credential abuse, scraping around access controls, data brokers, or breaches.
- A person's identity from a reporter installation token.
- A private person's identity from a business claim or numbering metadata.

## Reputation lifecycle
A reporter may maintain one vote per number. Re-submission updates that vote rather than multiplying it. New reporter trust begins at 0.25 and is capped at 0.75; trust is an abuse-resistance weighting, never a guarantee of truth.

Reports stop contributing when withdrawn or after 180 days without renewal. Scoring additionally reduces older active evidence with a 60-day half-life and considers category agreement and bounded evidence volume. Corrections require a separate moderation decision and do not automatically change reputation or identity claims.

## Storage direction
Persistent phone lookup keys use a server-side HMAC rather than raw phone numbers as database identifiers. Business identity and reputation expire independently. Android Room caches verified identity only so a caller label can be used locally without network I/O during screening.

## Remaining public-launch requirements
Before broad public release, deployments still need operational moderation procedures, privacy-policy/legal review, secret rotation, production load testing, data-minimized abuse telemetry, and incident-response procedures. These controls must not be implemented by adding invasive device or people fingerprinting.