-- Preserve already promised guest limits when administrators change current packages.
ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_package_code_check;
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_package_code_check CHECK(package_code IN ('start','basic','royal','hala_basic','hala_plus','hala_premium'));
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS guest_limit integer;
UPDATE payment_orders SET guest_limit=CASE package_code
  WHEN 'start' THEN 50 WHEN 'basic' THEN 200 WHEN 'royal' THEN 500
  WHEN 'hala_basic' THEN 100 WHEN 'hala_plus' THEN 250 WHEN 'hala_premium' THEN 500
  ELSE NULL END WHERE guest_limit IS NULL;
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_guest_limit_range CHECK(guest_limit IS NULL OR guest_limit BETWEEN 1 AND 5000);
INSERT INTO platform_settings(key,value) VALUES('catalog_config_v1','{}') ON CONFLICT(key) DO NOTHING;
