-- Attribute trials to the customer so creating another event cannot reset the allowance.
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS trial_user_id text REFERENCES users(id) ON DELETE SET NULL;
-- Existing unpaid sends consume the allowance; a provider failure remains retryable.
UPDATE whatsapp_messages AS m SET trial_user_id=owners.user_id
FROM (SELECT event_id, MIN(user_id) AS user_id FROM event_members WHERE member_role='owner' GROUP BY event_id) owners
WHERE m.event_id=owners.event_id AND m.trial_user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM payment_orders p WHERE p.event_id=m.event_id AND p.status='paid');
CREATE INDEX IF NOT EXISTS whatsapp_trial_user_idx ON whatsapp_messages(trial_user_id,status) WHERE trial_user_id IS NOT NULL;

-- The allowance must survive deleting a guest (which cascades its message log).
-- Deliberately no foreign key to a guest, event or message row.
CREATE TABLE IF NOT EXISTS customer_free_trials (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  message_attempt_id bigint NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO customer_free_trials(user_id,message_attempt_id)
SELECT trial_user_id,MIN(id) FROM whatsapp_messages
WHERE trial_user_id IS NOT NULL AND status IN ('queued','sent','delivered','read')
GROUP BY trial_user_id
ON CONFLICT(user_id) DO NOTHING;
