CREATE TABLE IF NOT EXISTS payment_orders (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_code text NOT NULL CHECK (package_code IN ('start','basic','royal')),
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','canceled')),
  provider text NOT NULL DEFAULT 'moyasar',
  provider_payment_id text,
  payment_method text,
  provider_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS payment_orders_event_idx ON payment_orders(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_one_paid_event_idx
  ON payment_orders(event_id) WHERE status = 'paid';
