ALTER TABLE guests ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_payment_status_check;
ALTER TABLE guests ADD CONSTRAINT guests_payment_status_check CHECK (payment_status IN ('unpaid','paid'));

CREATE INDEX IF NOT EXISTS guests_event_payment_status_idx ON guests(event_id, payment_status);
