# Reporter Trust and Abuse Controls Design

## Goal

Make ID-Call community reputation safe enough for controlled external testing by authenticating pseudonymous reporters, limiting report velocity, preventing duplicate voting, supporting correction requests, and enforcing report retention without collecting user identity data.

## Privacy boundary

Reporter identity is an app-installation identity, not a person identity. Registration requires no name, email, contact list, address, device phone number, GPS coordinate, advertising identifier, or IP persistence. The server stores an opaque reporter UUID and a SHA-256 hash of a random bearer token. Android stores the opaque token in app-private storage.

The existing product boundary remains unchanged: ID-Call must not infer live GPS or private residential addresses from phone numbers, scrape contacts, or enrich private-person identity through people-search providers.

## Reporter session

`POST /v1/reporters` creates a reporter and returns:

```json
{
  "reporterId": "uuid",
  "token": "base64url-random-secret"
}
```

The raw token is returned once and never persisted by the server. The server stores only `sha256(token)`.

Authenticated report/correction routes require:

```http
Authorization: Bearer <token>
```

Invalid, missing, disabled, or expired credentials return `401 REPORTER_AUTH_REQUIRED`.

## Report uniqueness and lifecycle

A reporter can maintain at most one active report for a telephone number. A second report from the same reporter and number updates the existing category, trust snapshot, `updated_at`, and `expires_at`; it does not add another vote.

Reports expire 180 days after the most recent submission. Reputation queries ignore expired and withdrawn reports. A maintenance command physically deletes expired and withdrawn records older than the retention cutoff.

A reporter may withdraw their own report. Withdrawn reports stop contributing immediately.

## Reporter trust

Reporter trust is deterministic and bounded; it is not treated as proof of correctness.

New reporters start at `0.25`. Effective trust increases slowly from tenure and accepted-report count and is capped at `0.75`:

- base: `0.25`
- tenure contribution: up to `0.25` over 180 days
- participation contribution: up to `0.25` over 50 accepted report submissions
- disabled reporters contribute `0`

This makes freshly-created brigading identities weak while avoiding an ungrounded claim that high activity equals truth. Future moderation outcomes may reduce or increase the stored trust ceiling, but are outside this stage.

## Rate limiting and anti-brigading

Rate limiting keys use reporter UUIDs rather than raw IP addresses.

Default limits:

- 20 report mutations per reporter per rolling hour
- 5 report mutations per reporter per target number per rolling 24 hours
- 10 correction requests per reporter per rolling 24 hours

The application depends on a `ReportRateLimiter` interface. Tests use an in-memory implementation; production uses Redis. Rejections return `429 REPORT_RATE_LIMITED` and include a `Retry-After` header when available.

One-reporter/one-number uniqueness is enforced in PostgreSQL with a unique constraint so concurrent requests cannot create duplicate votes.

## Corrections and appeals

`POST /v1/corrections` accepts an authenticated correction request with:

- `phoneNumber`
- `kind`: `incorrect_category`, `number_reassigned`, `legitimate_business`, or `other`
- optional `reason` limited to 500 characters

A correction request creates a moderation record with status `pending`. It never changes identity or reputation automatically.

`DELETE /v1/reports/:reportId` withdraws only a report owned by the authenticated reporter.

## API behavior

`POST /v1/reports` becomes authenticated and returns the durable `reportId`.

Lookup remains readable without reporter authentication. Community reputation is calculated from active, unexpired reports only.

Registration is deliberately unauthenticated but does not accept caller-supplied reporter IDs or trust values.

## Android integration

Android creates a reporter session lazily on the first report or correction action. `ReporterSessionStore` persists reporter ID and token in app-private `SharedPreferences` (`MODE_PRIVATE`). The network/data layer owns session creation and supplies bearer authorization only to mutation routes.

Lookup and call screening remain independent from reporter authentication; an authentication failure must never block caller screening.

## Retention maintenance

The API exposes a repository maintenance operation and a CLI entrypoint:

```bash
npm run retention:prune --workspace @id-call/api
```

The command deletes expired reports and withdrawn reports whose retention timestamp has passed. It is suitable for a daily cron job but does not require a scheduler inside the API process.

## Error contract

Mutation routes use stable error codes:

- `REPORTER_AUTH_REQUIRED` → 401
- `INVALID_REPORT` → 400
- `INVALID_CORRECTION` → 400
- `REPORT_NOT_FOUND` → 404
- `REPORT_RATE_LIMITED` → 429

## Non-goals

This stage does not add social login, email/password accounts, phone-number verification, public moderator tooling, automated correction approval, IP fingerprinting, device fingerprinting, or precise-person location.