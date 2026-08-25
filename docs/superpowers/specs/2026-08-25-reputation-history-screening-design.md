# Reputation, History and Screening UI Design

## Goal
Turn the lookup foundation into a useful caller-identification product with community reputation, local history, cache prewarming, and local-only incoming-call presentation.

## Safety and privacy constraints
- A telephone number is not a permanent person identity.
- No live GPS, private residential address, contact scraping, or people-search enrichment.
- Identity labels are limited to public business, verified/self-claimed, or other explicitly sourced claims.
- Incoming-call screening never performs network I/O.
- Community reports use controlled categories and are treated as reputation evidence, not factual identity claims.
- Persistent server correlation uses HMAC of E.164 numbers; raw numbers are not database primary identifiers.

## Backend
Add `ReputationRepository` with in-memory and PostgreSQL implementations. `POST /v1/reports` accepts a phone number and one controlled category. Lookup aggregates reputation evidence through the repository. PostgreSQL uses `PHONE_HMAC_SECRET` and the existing `phone_numbers`/`reputation_reports` tables.

Controlled categories: `spam`, `scam`, `telemarketing`, `robocall`, `debt_collection`, `legitimate_business`, `other`.

## Android
Room adds a lookup-history table and migration from schema v1 to v2. Successful manual lookups are recorded as history. Recent lookups can be prewarmed through WorkManager so screening has useful local data before a call arrives.

The screening service may show a local notification containing the cached display label, reputation level, and source-safe metadata. It must answer the screening callback first and remain fail-open.

The manual lookup feature gains a report action and a recent-history surface. Reports go through the normal repository/network path and never alter identity claims locally without a server response.

## Verification
Node build/tests/typecheck and Android Gradle tests must remain green. Repository and scoring behavior require unit tests; Room migration/schema changes must compile through KSP.