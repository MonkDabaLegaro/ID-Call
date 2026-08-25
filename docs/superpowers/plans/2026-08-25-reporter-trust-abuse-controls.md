# Reporter Trust and Abuse Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pseudonymous reporter authentication, duplicate-vote resistance, report/correction rate limits, report lifecycle controls, retention pruning, and Android reporter-session support.

**Architecture:** Keep caller lookup and screening unauthenticated/local-first while protecting only reputation mutations. Introduce small interfaces (`ReporterRepository`, `ReportRateLimiter`) so Fastify routes do not depend directly on PostgreSQL/Redis. Persist only reporter UUIDs and hashes of opaque bearer tokens server-side; Android owns the raw token in app-private storage.

**Tech Stack:** Node.js 24, TypeScript, Fastify 5, PostgreSQL 17, Redis 8, Android/Kotlin 2.2.21, Retrofit 3, Room 2.8.4, JUnit/Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-reporter-trust-abuse-controls-design.md`

## Global Constraints

- No name, email, advertising ID, contacts, device phone number, GPS, residential address, IP persistence, or people-search identity data may be collected for reporter registration.
- Raw bearer tokens must never be persisted server-side; persist only SHA-256 hashes.
- Reporter trust starts at 0.25 and is capped at 0.75.
- One reporter may have at most one active report per telephone number.
- Reports expire 180 days after the latest submission.
- Rate limits: 20 report mutations/reporter/hour; 5 report mutations/reporter/target/24h; 10 corrections/reporter/24h.
- Lookup and `CallScreeningService` must remain independent of reporter authentication.

---

### Task 1: Reporter authentication domain and storage

**Files:**
- Create: `apps/api/src/reporters/reporter-repository.ts`
- Create: `apps/api/src/reporters/postgres-reporter-repository.ts`
- Create: `apps/api/src/reporters/reporter-auth.ts`
- Test: `apps/api/src/reporters/reporter-auth.test.ts`
- Modify: `infrastructure/database/001_init.sql`

**Interfaces:**
- Produces: `ReporterRepository.create(): Promise<ReporterCredential>`, `ReporterRepository.authenticate(rawToken: string): Promise<AuthenticatedReporter | null>`, `calculateReporterTrust(reporter): number`.
- `ReporterCredential = { reporterId: string; token: string }`.
- `AuthenticatedReporter = { id: string; createdAt: Date; acceptedReports: number; disabledAt: Date | null }`.

- [ ] **Step 1: Write failing tests** proving raw tokens authenticate through a hash, wrong tokens return null, and trust is 0.25 for a new reporter and never exceeds 0.75.
- [ ] **Step 2: Run `npm test --workspace @id-call/api -- reporter-auth.test.ts` and confirm RED.**
- [ ] **Step 3: Implement `ReporterRepository` and deterministic `calculateReporterTrust`.** Generate tokens with `randomBytes(32).toString('base64url')`; store/compare `createHash('sha256').update(token).digest('hex')`.
- [ ] **Step 4: Add PostgreSQL reporter table:** UUID PK, unique token hash, accepted report count, created/updated/disabled timestamps. Never store raw token.
- [ ] **Step 5: Run API tests and commit `feat: add pseudonymous reporter authentication`.**

### Task 2: Unique report lifecycle

**Files:**
- Modify: `apps/api/src/reputation/reputation-repository.ts`
- Modify: `apps/api/src/reputation/postgres-reputation-repository.ts`
- Modify: `apps/api/src/reputation/reputation-repository.test.ts`
- Modify: `infrastructure/database/001_init.sql`

**Interfaces:**
- Replace mutation API with `upsert(subject, reporter, category): Promise<StoredReputationReport>`.
- Add `withdraw(reportId, reporterId): Promise<boolean>`.
- `list(number, now?)` returns only active/unexpired rows.

- [ ] **Step 1: Write failing tests** for same reporter+number updating instead of adding, expired/withdrawn exclusion, and owner-only withdrawal.
- [ ] **Step 2: Run focused tests and confirm RED.**
- [ ] **Step 3: Extend report model** with `id`, `reporterId`, `updatedAt`, `expiresAt`, `withdrawnAt`; preserve category/trust/createdAt.
- [ ] **Step 4: Add PostgreSQL columns/FK and `UNIQUE(phone_number_id, reporter_id)`. Implement `INSERT ... ON CONFLICT ... DO UPDATE` and owner-scoped withdrawal.
- [ ] **Step 5: Run tests and commit `feat: enforce one reporter vote per number`.**

### Task 3: Reporter rate limiting

**Files:**
- Create: `apps/api/src/abuse/report-rate-limiter.ts`
- Create: `apps/api/src/abuse/redis-report-rate-limiter.ts`
- Test: `apps/api/src/abuse/report-rate-limiter.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- `ReportRateLimiter.checkReport(reporterId, phoneHmac): Promise<RateLimitDecision>`.
- `ReportRateLimiter.checkCorrection(reporterId): Promise<RateLimitDecision>`.
- `RateLimitDecision = { allowed: boolean; retryAfterSeconds?: number }`.

- [ ] **Step 1: Write failing tests** for 20/hour reporter limit, 5/day target limit, correction 10/day, and window reset.
- [ ] **Step 2: Run tests and confirm RED.**
- [ ] **Step 3: Implement deterministic in-memory sliding/fixed-window test adapter.**
- [ ] **Step 4: Implement Redis adapter** using expiring counters with keys derived only from reporter UUID and HMAC target, never raw numbers.
- [ ] **Step 5: Run tests/typecheck and commit `feat: rate limit reputation mutations`.**

### Task 4: Protected report API and correction workflow

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`
- Create: `apps/api/src/corrections/correction-repository.ts`
- Create: `apps/api/src/corrections/postgres-correction-repository.ts`
- Modify: `infrastructure/database/001_init.sql`

**Interfaces:**
- `POST /v1/reporters` → 201 `{reporterId, token}`.
- `POST /v1/reports` requires Bearer token and returns `{reportId, number, category, reputation}`.
- `DELETE /v1/reports/:reportId` requires ownership.
- `POST /v1/corrections` requires Bearer token and creates pending correction.

- [ ] **Step 1: Write route tests** for registration, 401 missing/invalid bearer, 429 rate limits, upsert behavior, withdrawal ownership, correction validation/reason 500-char cap.
- [ ] **Step 2: Run tests and confirm RED.**
- [ ] **Step 3: Add auth helper to parse `Authorization: Bearer ...`; do not accept reporter ID/trust in bodies.**
- [ ] **Step 4: Wire mutation routes to auth + limiter + repositories and stable error codes.**
- [ ] **Step 5: Add `correction_requests` table with pending status and reporter/phone FKs.**
- [ ] **Step 6: Run build/test/typecheck and commit `feat: protect community reporting API`.**

### Task 5: Retention pruning

**Files:**
- Add method to: `apps/api/src/reputation/reputation-repository.ts`
- Modify: `apps/api/src/reputation/postgres-reputation-repository.ts`
- Create: `apps/api/src/retention/prune.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/src/retention/prune.test.ts`

**Interfaces:**
- `ReputationRepository.prune(now: Date): Promise<number>` returns deleted rows.
- CLI exits 0 and prints `Pruned <n> reputation reports`.

- [ ] **Step 1: Write failing tests** proving expired rows and withdrawn rows past retention are removed, active rows remain.
- [ ] **Step 2: Run focused tests and confirm RED.**
- [ ] **Step 3: Implement in-memory/PostgreSQL prune operation and CLI composition.**
- [ ] **Step 4: Add `retention:prune` npm script and run test/typecheck.**
- [ ] **Step 5: Commit `feat: add reputation retention pruning`.**

### Task 6: Android reporter session and authenticated reporting

**Files:**
- Create: `apps/android/core/data/src/main/java/dev/idcall/core/data/ReporterSessionStore.kt`
- Modify: `apps/android/core/network/src/main/java/dev/idcall/core/network/LookupApi.kt`
- Modify: `apps/android/core/network/src/main/java/dev/idcall/core/network/LookupApiFactory.kt`
- Modify: `apps/android/core/network/src/main/java/dev/idcall/core/network/LookupDtos.kt`
- Modify: `apps/android/core/data/src/main/java/dev/idcall/core/data/RetrofitLookupRemoteDataSource.kt`
- Modify: `apps/android/core/data/src/main/java/dev/idcall/core/data/LookupRepositoryFactory.kt`
- Test: `apps/android/core/data/src/test/java/dev/idcall/core/data/ReporterSessionManagerTest.kt`

**Interfaces:**
- `ReporterSessionStore.get(): ReporterSession?`, `save(session)`, `clear()`.
- `ReporterSessionManager.session(): ReporterSession` lazily registers if absent.
- Mutation requests receive `Authorization: Bearer <token>` explicitly; lookup remains unauthenticated.

- [ ] **Step 1: Write failing JVM tests** for existing-session reuse, lazy registration, and token reset/re-registration after 401.
- [ ] **Step 2: Run `gradle -p apps/android test` and confirm RED.**
- [ ] **Step 3: Implement app-private SharedPreferences session store and session manager.**
- [ ] **Step 4: Extend Retrofit DTO/API with reporter registration and bearer headers on report/correction mutations only.**
- [ ] **Step 5: Preserve screening path: no reporter session/network code may enter `platform/screening`.**
- [ ] **Step 6: Run Android tests and commit `feat: authenticate Android reputation reports`.**

### Task 7: Documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/privacy-model.md`

- [ ] **Step 1: Document reporter privacy model, authentication lifecycle, rate limits, retention, corrections, and CLI command.**
- [ ] **Step 2: Document that lookup/screening remain unauthenticated and report auth is not person verification.**
- [ ] **Step 3: Run fresh full verification:** `npm install`, `npm run build`, `npm test`, `npm run typecheck`, and `gradle -p apps/android test`.
- [ ] **Step 4: Compare branch to `feat/reputation-history-screening-ui`, ensure 0 behind, and create/update stacked PR without merging.**
- [ ] **Step 5: Commit `docs: document reporter trust and abuse controls`.**
