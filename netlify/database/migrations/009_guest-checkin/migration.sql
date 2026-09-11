ALTER TABLE guests ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_guests_event_checkin
  ON guests(event_id, checked_in_at)
  WHERE checked_in_at IS NOT NULL;
