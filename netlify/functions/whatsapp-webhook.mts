import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { secureJson } from "./_shared/domain.mjs";
import { extractStatuses, extractIncoming, nextStatus, providerError } from "./_shared/whatsapp.mjs";

export default async (req: Request) => {
  if (req.method === "GET") return secureJson({ ok: true, service: "hala-whatsapp-webhook", version: "delivery-v2" });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const token = Netlify.env.get("D360_WEBHOOK_TOKEN");
  if (!token) return new Response("Webhook not configured", { status: 503 });
  const encoder = new TextEncoder();
  const [expected, supplied] = await Promise.all([`Bearer ${token}`,req.headers.get("authorization") || ""]
    .map(async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))));
  let difference = 0;
  for (let i=0;i<expected.length;i++) difference |= expected[i] ^ supplied[i];
  if (difference !== 0) return new Response("Unauthorized", { status: 401 });
  const body = await req.text();
  if (body.length > 256_000) return new Response("Payload too large", { status: 413 });
  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const statuses = extractStatuses(payload).filter((s: any) => typeof s?.id === "string" && ['sent','delivered','read','failed'].includes(s?.status));
  const incoming = extractIncoming(payload);
  if (!statuses.length && !incoming.length) return new Response("ok");
  const client = await getDatabase().pool.connect();
  try {
    // Persist before acknowledgement so database errors cause provider retries.
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '3s'");
    for (const message of incoming) {
      await client.query(`INSERT INTO whatsapp_inbox(message_id,sender_phone,recipient_phone,message_type,body,provider_at)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(message_id) DO NOTHING`,
        [message.id,message.sender,message.recipient || null,message.type,message.body,message.providerAt]);
    }
    await client.query(`INSERT INTO whatsapp_webhook_state(id,last_received_at,observed_phone) VALUES(1,NOW(),$1)
      ON CONFLICT(id) DO UPDATE SET last_received_at=NOW(),observed_phone=COALESCE(EXCLUDED.observed_phone,whatsapp_webhook_state.observed_phone)`,
      [incoming.find(message => message.recipient)?.recipient || null]);
    for (const s of statuses) {
      const found = (await client.query("SELECT id, guest_id FROM whatsapp_messages WHERE message_id=$1", [s.id])).rows[0];
      if (!found) {
        const otp = (await client.query("SELECT id,delivery_status FROM otp_codes WHERE message_id=$1 FOR UPDATE", [s.id])).rows[0];
        if (otp) {
          const status = nextStatus(otp.delivery_status || 'queued', s.status);
          if (status !== otp.delivery_status) await client.query("UPDATE otp_codes SET delivery_status=$1 WHERE id=$2", [status,otp.id]);
          continue;
        }
        const notification=(await client.query("SELECT id,status FROM booking_notifications WHERE message_id=$1 FOR UPDATE",[s.id])).rows[0];
        if(notification){
          const status=nextStatus(notification.status,s.status);
          await client.query("UPDATE booking_notifications SET status=$1,error_code=$2,updated_at=NOW() WHERE id=$3",[status,status==='failed'?providerError({errors:s.errors}).code:null,notification.id]);
          continue;
        }
        throw new Error("Message not persisted yet");
      }
      // Same lock order as sender; old attempts must never change the latest guest state.
      await client.query("SELECT id FROM guests WHERE id=$1 FOR UPDATE", [found.guest_id]);
      const row = (await client.query("SELECT status FROM whatsapp_messages WHERE id=$1 FOR UPDATE", [found.id])).rows[0];
      const next = nextStatus(row.status, s.status);
      if (next === row.status) continue;
      const seconds = Number(s.timestamp);
      const at = Number.isFinite(seconds) && seconds > 0 && seconds <= Date.now()/1000 + 300 ? new Date(seconds*1000) : new Date();
      const error = next === 'failed' ? JSON.stringify(providerError({ errors: s.errors })) : null;
      if (next === 'failed') await client.query("DELETE FROM customer_free_trials WHERE message_attempt_id=$1", [found.id]);
      await client.query(`UPDATE whatsapp_messages SET status=$1, error=$2, updated_at=NOW(),
        sent_at=CASE WHEN $1 IN ('sent','delivered','read') THEN COALESCE(sent_at,$3) ELSE sent_at END,
        delivered_at=CASE WHEN $1 IN ('delivered','read') THEN COALESCE(delivered_at,$3) ELSE delivered_at END,
        read_at=CASE WHEN $1='read' THEN COALESCE(read_at,$3) ELSE read_at END,
        failed_at=CASE WHEN $1='failed' THEN COALESCE(failed_at,$3) ELSE NULL END WHERE id=$4`, [next,error,at,found.id]);
      await client.query(`UPDATE guests SET whatsapp_status=$1, whatsapp_error=$2,
        whatsapp_sent_at=CASE WHEN $1 IN ('sent','delivered','read') THEN COALESCE(whatsapp_sent_at,$3) ELSE whatsapp_sent_at END,
        whatsapp_delivered_at=CASE WHEN $1 IN ('delivered','read') THEN COALESCE(whatsapp_delivered_at,$3) ELSE whatsapp_delivered_at END,
        whatsapp_read_at=CASE WHEN $1='read' THEN COALESCE(whatsapp_read_at,$3) ELSE whatsapp_read_at END,
        whatsapp_failed_at=CASE WHEN $1='failed' THEN COALESCE(whatsapp_failed_at,$3) ELSE NULL END
        WHERE id=$4 AND whatsapp_message_id=$5`, [next,error,at,found.guest_id,s.id]);
    }
    await client.query("COMMIT");
    return new Response("ok");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return new Response("Retry callback", { status: 503, headers: { "retry-after": "5" } });
  } finally { client.release(); }
};

export const config: Config = { path: "/api/whatsapp/webhook" };
