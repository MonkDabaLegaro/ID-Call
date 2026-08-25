CREATE TABLE IF NOT EXISTS reporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  accepted_reports integer NOT NULL DEFAULT 0 CHECK (accepted_reports >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

ALTER TABLE reputation_reports
  ADD COLUMN IF NOT EXISTS reporter_id uuid REFERENCES reporters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS reputation_reports_reporter_phone_unique
  ON reputation_reports(phone_number_id, reporter_id)
  WHERE reporter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reputation_reports_active_idx
  ON reputation_reports(phone_number_id, expires_at DESC)
  WHERE withdrawn_at IS NULL;

CREATE TABLE IF NOT EXISTS correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES reporters(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('incorrect_category','number_reassigned','legitimate_business','other')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS correction_requests_reporter_idx
  ON correction_requests(reporter_id, created_at DESC);
