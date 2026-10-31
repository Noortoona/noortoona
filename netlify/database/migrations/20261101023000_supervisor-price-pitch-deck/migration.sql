-- Align only the supervisor add-on's future price with the approved HALA pitch deck.
-- Does not modify past paid orders, existing supervisor request amounts, or event records.
-- The ordinary admin settings API remains able to edit the price later.
INSERT INTO platform_settings(key, value, updated_at)
VALUES ('supervisor_addon_sar', '299', NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW()
WHERE platform_settings.value IS DISTINCT FROM EXCLUDED.value;
