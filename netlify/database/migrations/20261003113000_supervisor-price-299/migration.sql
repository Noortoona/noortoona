INSERT INTO platform_settings(key,value,updated_at)
VALUES('supervisor_addon_sar','299',NOW())
ON CONFLICT(key) DO UPDATE SET value='299',updated_at=NOW();
