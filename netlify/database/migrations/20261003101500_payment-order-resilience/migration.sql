DROP INDEX IF EXISTS payment_orders_one_paid_event_idx;

CREATE INDEX IF NOT EXISTS payment_orders_paid_event_idx
  ON payment_orders(event_id, paid_at DESC)
  WHERE status = 'paid';
