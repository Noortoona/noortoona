CREATE TABLE IF NOT EXISTS admin_email_otp_codes (
 id text PRIMARY KEY,
 email text NOT NULL,
 code_hash text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 sent_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_email_otp_lookup_idx ON admin_email_otp_codes(email,sent_at DESC);
