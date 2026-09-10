ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_status TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_error TEXT;

CREATE INDEX IF NOT EXISTS guests_whatsapp_message_id_idx ON guests(whatsapp_message_id);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  message_id TEXT UNIQUE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'invite' CHECK (kind IN ('invite','reminder')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_guest_idx ON whatsapp_messages(guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_event_idx ON whatsapp_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_message_idx ON whatsapp_messages(message_id);
