CREATE TABLE IF NOT EXISTS whatsapp_inbox (
  message_id text PRIMARY KEY,
  sender_phone text NOT NULL,
  recipient_phone text,
  message_type text NOT NULL,
  body text NOT NULL DEFAULT '',
  provider_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT NOW(),
  resolved_at timestamptz,
  resolved_by text REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS whatsapp_inbox_pending ON whatsapp_inbox(received_at DESC) WHERE resolved_at IS NULL;
CREATE TABLE IF NOT EXISTS whatsapp_webhook_state (
  id integer PRIMARY KEY CHECK (id=1),
  last_received_at timestamptz NOT NULL,
  observed_phone text
);
