import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

function normalizePhone(phone: string) {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0") && p.length === 10) p = "966" + p.slice(1);
  if (p.length === 9 && p.startsWith("5")) p = "966" + p;
  return p;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function formatSaudiDate(dateValue: unknown, timeValue?: unknown) {
  if (!dateValue) return "";
  const rawDate = dateValue instanceof Date
    ? dateValue.toISOString().slice(0, 10)
    : String(dateValue).slice(0, 10);
  const date = new Date(`${rawDate}T12:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  const day = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh"
  }).format(date);
  const time = String(timeValue || "").trim();
  if (!time) return day;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return day;
  const timeDate = new Date(`${rawDate}T${match[1].padStart(2, "0")}:${match[2]}:00+03:00`);
  const clock = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh"
  }).format(timeDate);
  return `${day} — ${clock}`;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Netlify.env.get("D360_API_KEY");
  const apiBase = (Netlify.env.get("D360_API_BASE") || "https://waba-sandbox.360dialog.io/v1").replace(/\/$/, "");
  const mode = Netlify.env.get("D360_MODE") || "sandbox";
  if (!apiKey) return json({ error: "WhatsApp API is not configured", code: "D360_NOT_CONFIGURED" }, 503);

  const body: any = await req.json().catch(() => ({}));
  const { eventId, ownerToken, guestId, reminder = false } = body;
  if (!eventId || !ownerToken || !guestId) return json({ error: "Missing fields" }, 400);

  const db = getDatabase();
  const [row]: any[] = await db.sql`
    SELECT g.*, e.title, e.event_date, e.event_time, e.location, e.owner_token
    FROM guests g
    JOIN events e ON e.id = g.event_id
    WHERE g.id = ${guestId} AND g.event_id = ${eventId} AND e.owner_token = ${ownerToken}
  `;
  if (!row) return json({ error: "Guest not found" }, 404);

  const to = normalizePhone(row.phone || "");
  if (!to) return json({ error: "Guest phone is missing" }, 400);

  const origin = new URL(req.url).origin;
  const inviteUrl = `${origin}/i/${row.code}`;
  const eventDate = formatSaudiDate(row.event_date, row.event_time);
  const text = `${reminder ? "تذكير لطيف ✨\n\n" : ""}مرحبًا ${row.name} ✨\nيشرفنا دعوتكم إلى ${row.title}.\n${eventDate ? `📅 ${eventDate}\n` : ""}${row.location ? `📍 ${row.location}\n` : ""}\n${reminder ? "يسعدنا تأكيد حضوركم من الرابط:\n" : "لمشاهدة الدعوة وتأكيد الحضور:\n"}${inviteUrl}`;

  const kind = reminder ? "reminder" : "invite";
  const [log]: any[] = await db.sql`
    INSERT INTO whatsapp_messages (event_id, guest_id, kind, status)
    VALUES (${eventId}, ${guestId}, ${kind}, 'queued')
    RETURNING id
  `;

  // Sandbox accepts free-form text. Production requires an approved template to initiate
  // conversations, so production remains intentionally blocked until template settings exist.
  if (mode !== "sandbox" && !Netlify.env.get("D360_ALLOW_FREEFORM_PRODUCTION")) {
    const error = "Production template is not configured";
    await db.sql`UPDATE whatsapp_messages SET status='failed', error=${error}, failed_at=NOW(), updated_at=NOW() WHERE id=${log.id}`;
    return json({ error, code: "D360_TEMPLATE_REQUIRED" }, 409);
  }

  const response = await fetch(`${apiBase}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "D360-API-KEY": apiKey },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text } }),
  });
  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = JSON.stringify(data);
    await db.sql`UPDATE whatsapp_messages SET status='failed', error=${error}, failed_at=NOW(), updated_at=NOW() WHERE id=${log.id}`;
    await db.sql`UPDATE guests SET whatsapp_status='failed', whatsapp_failed_at=NOW(), whatsapp_error=${error} WHERE id=${guestId}`;
    return json({ error: "WhatsApp send failed", details: data }, 502);
  }

  const messageId = data?.messages?.[0]?.id || null;
  await db.sql`
    UPDATE whatsapp_messages
    SET message_id=${messageId}, status='sent', sent_at=NOW(), updated_at=NOW()
    WHERE id=${log.id}
  `;
  await db.sql`
    UPDATE guests
    SET whatsapp_message_id=${messageId}, whatsapp_status='sent', whatsapp_sent_at=NOW(),
        whatsapp_delivered_at=NULL, whatsapp_read_at=NULL, whatsapp_failed_at=NULL, whatsapp_error=NULL
    WHERE id=${guestId}
  `;

  return json({ ok: true, messageId, status: "sent", mode });
};

export const config: Config = { path: "/api/whatsapp/send" };
