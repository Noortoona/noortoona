ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','customer','supervisor','partner','customer_service'));

CREATE TABLE bookings (
 id text PRIMARY KEY, booking_number text NOT NULL UNIQUE,
 event_id text NOT NULL UNIQUE REFERENCES events(id), user_id text REFERENCES users(id),
 idempotency_key text NOT NULL UNIQUE, access_token_hash text NOT NULL, request_hash text NOT NULL, environment text NOT NULL DEFAULT 'legacy_unclassified',
 contact_name text NOT NULL, contact_phone text NOT NULL, contact_email text,
 guest_count integer NOT NULL CHECK(guest_count>0), guest_limit integer NOT NULL CHECK(guest_limit>=guest_count),
 package_code text NOT NULL, package_name text NOT NULL,
 event_snapshot jsonb NOT NULL, design_json jsonb NOT NULL DEFAULT '{}', services_json jsonb NOT NULL DEFAULT '[]',
 base_amount integer NOT NULL CHECK(base_amount>=0), addon_amount integer NOT NULL CHECK(addon_amount>=0),
 discount_amount integer NOT NULL CHECK(discount_amount>=0), total_amount integer NOT NULL CHECK(total_amount>0),
 currency text NOT NULL DEFAULT 'SAR', referral_code text, partner_user_id text REFERENCES users(id),
 commission_amount integer NOT NULL DEFAULT 0 CHECK(commission_amount>=0), attribution jsonb NOT NULL DEFAULT '{}',
 booking_status text NOT NULL DEFAULT 'pre_booking_received' CHECK(booking_status IN ('pre_booking_received','contacted','awaiting_confirmation','confirmed','cancelled')),
 payment_status text NOT NULL DEFAULT 'pending_payment' CHECK(payment_status IN ('pending_payment','paid','refunded')),
 assigned_user_id text REFERENCES users(id), followup_status text NOT NULL DEFAULT 'new', notes text NOT NULL DEFAULT '',
 last_follow_up_at timestamptz, next_follow_up_at timestamptz, marketing_consent boolean NOT NULL DEFAULT false,
 session_id text, visitor_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz
);
CREATE INDEX bookings_customer_idx ON bookings(user_id,created_at DESC);
CREATE INDEX bookings_status_idx ON bookings(booking_status,payment_status,created_at DESC);
CREATE INDEX bookings_followup_idx ON bookings(assigned_user_id,next_follow_up_at);

CREATE TABLE leads (
 id text PRIMARY KEY, name text, phone text, email text, service text, kind text NOT NULL CHECK(kind IN ('launch','contact','pre_booking')),
 source jsonb NOT NULL DEFAULT '{}', environment text NOT NULL DEFAULT 'legacy_unclassified', marketing_consent boolean NOT NULL DEFAULT false, user_id text REFERENCES users(id),
 contact_status text NOT NULL DEFAULT 'new', assigned_user_id text REFERENCES users(id), notes text NOT NULL DEFAULT '',
 last_follow_up_at timestamptz, next_follow_up_at timestamptz, idempotency_key text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(phone IS NOT NULL OR email IS NOT NULL)
);
CREATE UNIQUE INDEX leads_phone_kind_idx ON leads(phone,environment) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX leads_email_kind_idx ON leads(lower(email),environment) WHERE email IS NOT NULL;

CREATE TABLE booking_notifications (
 id text PRIMARY KEY, booking_id text NOT NULL REFERENCES bookings(id), event_name text NOT NULL DEFAULT 'booking.created',
 kind text NOT NULL CHECK(kind IN ('internal','whatsapp')),
 status text NOT NULL CHECK(status IN ('pending_setup','queued','sent','delivered','read','failed')),
 message text NOT NULL, recipient text, message_id text UNIQUE, error_code text, attempted_at timestamptz, read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(booking_id,kind,event_name)
);
ALTER TABLE payment_orders ADD COLUMN booking_id text REFERENCES bookings(id);
CREATE UNIQUE INDEX payment_booking_active_idx ON payment_orders(booking_id) WHERE booking_id IS NOT NULL AND status IN ('pending','paid');
INSERT INTO platform_settings(key,value) VALUES('support_phone','966532763736'),('booking_notification_phone','966532763736') ON CONFLICT(key) DO NOTHING;
