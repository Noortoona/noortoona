-- Keep historical events intact. Their origin and consent cannot be invented.
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_id text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS event_id text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS source jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS device_type text NOT NULL DEFAULT 'unknown';
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'legacy_unclassified';
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS consent boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS page_views_event_id_unique ON page_views(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS page_views_environment_date_idx ON page_views(environment,created_at DESC);
-- Historical paid rows cannot safely be called live revenue without mode evidence.
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'legacy_unclassified';
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'unknown';
CREATE INDEX IF NOT EXISTS payment_orders_environment_mode_idx ON payment_orders(environment,payment_mode,status);
