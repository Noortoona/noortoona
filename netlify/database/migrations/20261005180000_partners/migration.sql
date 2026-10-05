-- A partner is an OTP account. The profile determines whether its code grants a discount.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','supervisor','customer','partner'));

CREATE TABLE IF NOT EXISTS partner_profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('venue','influencer')),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{4,24}$'),
  commission_bps integer NOT NULL DEFAULT 1000 CHECK (commission_bps BETWEEN 0 AND 10000),
  discount_bps integer NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_kind_discount CHECK (kind='influencer' OR discount_bps=0)
);

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS referral_partner_id text REFERENCES partner_profiles(user_id) ON DELETE SET NULL;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS commission_amount integer NOT NULL DEFAULT 0 CHECK (commission_amount >= 0);

-- One acquisition per customer; subsequent events never earn a second acquisition commission.
CREATE TABLE IF NOT EXISTS customer_acquisitions (
  customer_user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_order_id text NOT NULL UNIQUE REFERENCES payment_orders(id),
  partner_user_id text REFERENCES partner_profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_commissions (
  id text PRIMARY KEY,
  customer_user_id text NOT NULL UNIQUE REFERENCES users(id),
  partner_user_id text NOT NULL REFERENCES partner_profiles(user_id),
  order_id text NOT NULL UNIQUE REFERENCES payment_orders(id),
  amount integer NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS partner_commissions_partner_idx ON partner_commissions(partner_user_id,created_at DESC);
