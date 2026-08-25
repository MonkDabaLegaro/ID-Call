CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hmac text NOT NULL UNIQUE,
  country_code text NOT NULL,
  region_code text,
  number_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  identity_type text NOT NULL CHECK (identity_type IN ('business','self-claimed','public-directory')),
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES identity_claims(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_reference text,
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  observed_at timestamptz NOT NULL
);

CREATE TABLE reputation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('spam','scam','telemarketing','robocall','debt_collection','legitimate_business','other')),
  reporter_trust numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (reporter_trust BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reputation_reports_phone_idx ON reputation_reports(phone_number_id, created_at DESC);
