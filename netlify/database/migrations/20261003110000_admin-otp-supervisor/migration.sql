CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT 'عميل هلا',
  email text UNIQUE,
  phone text UNIQUE,
  password_salt text,
  password_hash text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','supervisor','customer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_salt DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS event_members (
  event_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role text NOT NULL CHECK (member_role IN ('owner','supervisor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS event_members_user_idx ON event_members(user_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  id text PRIMARY KEY,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_codes_phone_idx ON otp_codes(phone,sent_at DESC);

CREATE TABLE IF NOT EXISTS page_views (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  event_name text NOT NULL,
  path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_created_idx ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_session_idx ON page_views(session_id,created_at DESC);

CREATE TABLE IF NOT EXISTS supervisor_requests (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','assigned','completed','canceled')),
  assigned_supervisor_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS supervisor_requests_status_idx ON supervisor_requests(status,created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS payment_orders (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_code text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','canceled')),
  provider text NOT NULL DEFAULT 'moyasar',
  provider_payment_id text,
  payment_method text,
  provider_message text,
  supervisor_addon_amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS payment_orders_event_idx ON payment_orders(event_id,created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders(user_id,created_at DESC);

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS supervisor_addon_amount integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_settings(key,value) VALUES('supervisor_addon_sar','299')
ON CONFLICT(key) DO NOTHING;
