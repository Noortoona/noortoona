-- Keep the previously applied 20261109010000 migration immutable.
-- Existing codes were issued before a user binding was available: expire them safely.
DELETE FROM admin_email_otp_codes;
ALTER TABLE admin_email_otp_codes
 ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE admin_email_otp_codes
 ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS admin_email_otp_user_idx ON admin_email_otp_codes(user_id);
