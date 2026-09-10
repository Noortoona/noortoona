import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

function extractStatuses(payload: any) {
  if (Array.isArray(payload?.statuses)) return payload.statuses;
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  return entries.flatMap((entry: any) => (entry?.changes || []).flatMap((change: any) => change?.value?.statuses || []));
}

export default async (req: Request) => {
  // A GET is useful as a safe browser/monitor health check; 360dialog sends status payloads via POST.
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, service: "noortoona-whatsapp-webhook" }), { headers: { "content-type": "application/json" } });
  if (req.method !== "POST") return new Response("ok");

  const payload: any = await req.json().catch(() => ({}));
  const statuses = extractStatuses(payload);
  if (!statuses.length) return new Response("ok");

  const db = getDatabase();
  for (const s of statuses) {
    const messageId = s?.id;
    const status = s?.status;
    if (!messageId || !["sent", "delivered", "read", "failed"].includes(status)) continue;
    const error = s?.errors?.length ? JSON.stringify(s.errors) : null;

    if (status === "sent") {
      await db.sql`UPDATE whatsapp_messages SET status='sent', sent_at=COALESCE(sent_at,NOW()), updated_at=NOW() WHERE message_id=${messageId}`;
      await db.sql`UPDATE guests SET whatsapp_status='sent', whatsapp_sent_at=COALESCE(whatsapp_sent_at,NOW()) WHERE whatsapp_message_id=${messageId}`;
    } else if (status === "delivered") {
      await db.sql`UPDATE whatsapp_messages SET status='delivered', delivered_at=NOW(), updated_at=NOW() WHERE message_id=${messageId}`;
      await db.sql`UPDATE guests SET whatsapp_status='delivered', whatsapp_delivered_at=NOW() WHERE whatsapp_message_id=${messageId}`;
    } else if (status === "read") {
      await db.sql`UPDATE whatsapp_messages SET status='read', read_at=NOW(), delivered_at=COALESCE(delivered_at,NOW()), updated_at=NOW() WHERE message_id=${messageId}`;
      await db.sql`UPDATE guests SET whatsapp_status='read', whatsapp_read_at=NOW(), whatsapp_delivered_at=COALESCE(whatsapp_delivered_at,NOW()) WHERE whatsapp_message_id=${messageId}`;
    } else if (status === "failed") {
      await db.sql`UPDATE whatsapp_messages SET status='failed', failed_at=NOW(), error=${error}, updated_at=NOW() WHERE message_id=${messageId}`;
      await db.sql`UPDATE guests SET whatsapp_status='failed', whatsapp_failed_at=NOW(), whatsapp_error=${error} WHERE whatsapp_message_id=${messageId}`;
    }
  }

  return new Response("ok");
};

export const config: Config = { path: "/api/whatsapp/webhook" };
