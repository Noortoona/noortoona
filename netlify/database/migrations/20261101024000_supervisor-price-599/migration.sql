-- New prospective supervisor/supervisora service price, approved 2026-11-01.
-- Preserve completed orders and previously agreed service request amounts.
-- Does not change existing events, paid orders, or send messages.
INSERT INTO platform_settings(key, value, updated_at)
VALUES ('supervisor_addon_sar', '599', NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW()
WHERE platform_settings.value IS DISTINCT FROM EXCLUDED.value;
