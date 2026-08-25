# Privacy Model

ID-Call distinguishes numbering metadata from physical-person location.

## Allowed foundation data
- E.164 normalization and validity.
- Country/numbering-region metadata.
- Number type where available.
- Public business identity claims with evidence.
- Community reputation reports and aggregates.

## Explicitly not inferred
- Live device GPS position from a phone number.
- Private residential address from a phone number.
- Hidden/private personal profiles obtained through credential abuse, scraping around access controls, or data breaches.

## Storage direction
Persistent lookup keys should use a server-side HMAC rather than making raw phone numbers the primary database identifier. Identity claims and evidence expire independently so stale ownership assumptions can be removed without deleting reputation history blindly.

Before a public launch the service must add authenticated rate limits, correction/opt-out workflows, abuse monitoring and retention policies.
