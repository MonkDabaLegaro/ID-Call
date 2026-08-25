ALTER TABLE identity_claims
  ADD COLUMN IF NOT EXISTS reporter_id uuid REFERENCES reporters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','expired')),
  ADD COLUMN IF NOT EXISTS public_website text,
  ADD COLUMN IF NOT EXISTS public_address text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE identity_claims
  DROP CONSTRAINT IF EXISTS identity_claims_identity_type_check;

ALTER TABLE identity_claims
  ADD CONSTRAINT identity_claims_identity_type_check
  CHECK (identity_type IN ('business','self-claimed','public-directory','verified-business'));

CREATE INDEX IF NOT EXISTS identity_claims_status_idx
  ON identity_claims(status, created_at DESC);

CREATE INDEX IF NOT EXISTS identity_claims_phone_active_idx
  ON identity_claims(phone_number_id, expires_at DESC)
  WHERE status = 'verified';

CREATE INDEX IF NOT EXISTS correction_requests_status_idx
  ON correction_requests(status, created_at DESC);
