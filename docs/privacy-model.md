# Privacy Model

ID-Call distinguishes numbering metadata from physical-person location and installation authentication from human identity.

## Allowed data
- E.164 normalization and validity.
- Country/numbering-region metadata.
- Number type where available.
- Public business identity claims with evidence.
- Community reputation reports and aggregates.
- A pseudonymous reporter UUID and hash of an opaque installation token.
- Pending correction requests needed to challenge reputation data.

## Reporter privacy
Reporter registration does not require or accept a name, email, contact list, device phone number, advertising identifier, GPS coordinate, residential address, or caller-supplied trust score. The bearer token is returned to the Android installation and persistent server storage keeps only a SHA-256 hash.

Reporter authentication proves possession of that installation token. It is not identity verification and must not be presented as evidence that the reporter is a particular person.

Rate-limit storage is keyed by reporter UUID and a hashed target key. Raw target telephone numbers are not Redis rate-limit keys.

## Explicitly not inferred
- Live device GPS position from a phone number.
- Private residential address from a phone number.
- Hidden/private personal profiles obtained through credential abuse, scraping around access controls, data brokers, or breaches.
- A person's identity from a reporter installation token.

## Reputation lifecycle
A reporter may maintain one vote per number. Re-submission updates that vote rather than multiplying it. New reporter trust begins at 0.25 and is capped at 0.75; trust is only an abuse-resistance weighting, never a guarantee of truth.

Reports stop contributing when withdrawn or after 180 days without renewal. Expired records and sufficiently old withdrawn records are eligible for physical pruning. Corrections remain pending until a separate moderation decision; they do not automatically change reputation or identity claims.

## Storage direction
Persistent phone lookup keys use a server-side HMAC rather than raw phone numbers as database identifiers. Identity claims and evidence expire independently from reputation evidence. PostgreSQL stores only the data required for these bounded product functions.

## Remaining public-launch requirements
Before broad public release, deployments still need operational moderation procedures, privacy-policy/legal review, secret rotation, production load testing, abuse telemetry designed for data minimization, and incident-response procedures. These operational controls must not be implemented by adding invasive device or people fingerprinting.
