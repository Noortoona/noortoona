-- Pre-launch bookings are genuine customer actions, distinct from revenue.
CREATE TABLE IF NOT EXISTS booking_requests (
  id text PRIMARY KEY,
  event_id text NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  customer_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_code text NOT NULL UNIQUE,
  package_code text NOT NULL,
  package_name text NOT NULL,
  guest_limit integer NOT NULL CHECK (guest_limit > 0),
  amount integer NOT NULL CHECK (amount >= 0),
  discount_amount integer NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  referral_code text,
  status text NOT NULL DEFAULT 'pending_contact' CHECK (status IN ('pending_contact','contacted','awaiting_payment','confirmed','completed','canceled')),
  payment_status text NOT NULL DEFAULT 'pending_payment' CHECK (payment_status IN ('pending_payment','paid','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_requests_created_idx ON booking_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS booking_requests_status_idx ON booking_requests(status,created_at DESC);

-- Notification attempts are durable, independent from booking success.
CREATE TABLE IF NOT EXISTS booking_notifications (
  id text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','accepted','sent','delivered','read','failed','uncertain')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id,channel)
);
CREATE UNIQUE INDEX IF NOT EXISTS booking_notifications_provider_id_idx
  ON booking_notifications(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_notifications_status_idx ON booking_notifications(status,created_at);
