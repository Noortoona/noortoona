ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS message_id text;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS delivery_status text;
CREATE UNIQUE INDEX IF NOT EXISTS otp_codes_message_id_unique ON otp_codes(message_id) WHERE message_id IS NOT NULL;
