import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { isSameOriginRequest, ownerTokenFrom, secureJson } from "./_shared/domain.mjs";
import { providerConfig, providerError } from "./_shared/whatsapp.mjs";

function normalizePhone(phone: string) {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0") && p.length === 10) p = "966" + p.slice(1);
  if (p.length === 9 && p.startsWith("5")) p = "966" + p;
  return p;
}

function json(data: unknown, status = 200) {
  return secureJson(data, status);
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
  if (!isSameOriginRequest(req)) return json({ error: "Request not allowed" }, 403);

  const apiKey = Netlify.env.get("D360_API_KEY");
  let settings: { mode: string; apiBase: string };
  try { settings = providerConfig((name: string) => Netlify.env.get(name)); }
  catch (error) { return json({ error: "إعدادات واتساب غير مكتملة أو غير متطابقة", code: (error as Error).message }, 503); }
  const { mode, apiBase } = settings;
  if (!Netlify.env.get("D360_WEBHOOK_TOKEN")) return json({ error: "يلزم إعداد حماية وتتبع Webhook قبل الإرسال", code: "D360_WEBHOOK_REQUIRED" }, 503);
  const templateName = Netlify.env.get("D360_INVITE_TEMPLATE");

  const body: any = await req.json().catch(() => ({}));
  const { eventId, guestId, reminder = false } = body;
  const selectedTemplate = reminder ? Netlify.env.get("D360_REMINDER_TEMPLATE") : templateName;
  const templateLanguage = Netlify.env.get("D360_TEMPLATE_LANGUAGE");
  if (mode === "production" && (!selectedTemplate || !templateLanguage)) return json({ error: "اسم القالب المعتمد أو لغته غير مضبوطين", code: "D360_TEMPLATE_REQUIRED" }, 409);
  const ownerToken = ownerTokenFrom(req, body).slice(0, 120);
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
  if (!/^[1-9]\d{7,14}$/.test(to)) return json({ error: "رقم جوال الضيف غير صالح", code: "INVALID_PHONE" }, 400);

  const origin = new URL(req.url).origin;
  const inviteUrl = `${origin}/i/${row.code}`;
  const eventDate = formatSaudiDate(row.event_date, row.event_time);
  const text = `${reminder ? "تذكير لطيف ✨\n\n" : ""}مرحبًا ${row.name} ✨\nيشرفنا دعوتكم إلى ${row.title}.\n${eventDate ? `📅 ${eventDate}\n` : ""}${row.location ? `📍 ${row.location}\n` : ""}\n${reminder ? "يسعدنا تأكيد حضوركم من الرابط:\n" : "لمشاهدة الدعوة وتأكيد الحضور:\n"}${inviteUrl}`;

  const kind = reminder ? "reminder" : "invite";
  // Atomically reserve an attempt. A queued/uncertain attempt must not be resent.
  const client = await db.pool.connect();
  let log: any;
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM guests WHERE id=$1 FOR UPDATE", [guestId]);
    const previous = await client.query(`SELECT id, message_id, status FROM whatsapp_messages
      WHERE guest_id=$1 AND (status='queued' OR (kind=$2 AND status IN ('sent','delivered','read')))
      ORDER BY created_at DESC LIMIT 1`, [guestId, kind]);
    if (previous.rows.length) {
      await client.query("ROLLBACK");
      return json({ error: "توجد محاولة قائمة؛ راجع حالتها قبل إعادة الإرسال", code: "D360_DUPLICATE", messageId: previous.rows[0].message_id, status: previous.rows[0].status }, 409);
    }
    log = (await client.query(`INSERT INTO whatsapp_messages (event_id,guest_id,kind,status)
      VALUES ($1,$2,$3,'queued') RETURNING id`, [eventId, guestId, kind])).rows[0];
    await client.query(`UPDATE guests SET whatsapp_status='queued', whatsapp_message_id=NULL,
      whatsapp_sent_at=NULL, whatsapp_delivered_at=NULL, whatsapp_read_at=NULL,
      whatsapp_failed_at=NULL, whatsapp_error=NULL WHERE id=$1`, [guestId]);
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return json({ error: "تعذر تسجيل محاولة الإرسال؛ لم يُرسل الطلب", code: "D360_ATTEMPT_FAILED" }, 503);
  } finally { client.release(); }

  // Business-initiated production messages must use a Meta-approved template. The body
  // parameters below intentionally use the same order for invitations and reminders:
  // guest name, event title, date/time, location, unique invitation URL.

  const messagePayload = mode === "production"
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: selectedTemplate,
          language: { code: templateLanguage },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: String(row.name || "ضيف هلا") },
              { type: "text", text: String(row.title || "مناسبة هلا") },
              { type: "text", text: eventDate || "سيتم تحديد الموعد" },
              { type: "text", text: String(row.location || "سيتم تحديد الموقع") },
              { type: "text", text: inviteUrl },
            ],
          }],
        },
      }
    : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      };

  let response: Response;
  try { response = await fetch(`${apiBase}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "D360-API-KEY": apiKey! },
    body: JSON.stringify(messagePayload),
    signal: AbortSignal.timeout(15000),
  }); } catch {
    // A timeout is not proof that the provider rejected the message. Do not retry.
    const error = JSON.stringify({ code: "D360_OUTCOME_UNKNOWN", message: "انقطع الاتصال؛ نتيجة الطلب غير مؤكدة. لا تعد الإرسال قبل مراجعة المزود." });
    await db.sql`UPDATE whatsapp_messages SET error=${error}, updated_at=NOW() WHERE id=${log.id}`;
    await db.sql`UPDATE guests SET whatsapp_error=${error} WHERE id=${guestId}`;
    return json({ error: "نتيجة الطلب غير مؤكدة؛ لم يتأكد الإرسال أو التسليم", code: "D360_OUTCOME_UNKNOWN", status: "queued" }, 504);
  }
  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    const diagnostic = providerError(data);
    const error = JSON.stringify(diagnostic);
    await db.sql`UPDATE whatsapp_messages SET status='failed', error=${error}, failed_at=NOW(), updated_at=NOW() WHERE id=${log.id}`;
    await db.sql`UPDATE guests SET whatsapp_status='failed', whatsapp_failed_at=NOW(), whatsapp_error=${error} WHERE id=${guestId}`;
    const code = mode === "sandbox" && response.status === 403
      ? "D360_SANDBOX_RECIPIENT_ONLY"
      : "D360_SEND_FAILED";
    return json({ error: diagnostic.message, code, providerCode: diagnostic.code }, 502);
  }

  const messageId = data?.messages?.[0]?.id;
  if (typeof messageId !== "string" || !messageId.trim()) {
    const error = JSON.stringify({ code: "D360_MESSAGE_ID_MISSING", message: "قبل المزود الطلب دون معرّف رسالة؛ التسليم غير مؤكد. يلزم مراجعة المزود قبل إعادة الإرسال." });
    await db.sql`UPDATE whatsapp_messages SET error=${error}, updated_at=NOW() WHERE id=${log.id}`;
    await db.sql`UPDATE guests SET whatsapp_error=${error} WHERE id=${guestId}`;
    return json({ error: "لم يُرجع المزود معرّفًا صالحًا للرسالة", code: "D360_MESSAGE_ID_MISSING", status: "queued" }, 502);
  }
  const finalizer = await db.pool.connect();
  try {
    await finalizer.query("BEGIN");
    await finalizer.query("SELECT id FROM guests WHERE id=$1 FOR UPDATE", [guestId]);
    await finalizer.query("UPDATE whatsapp_messages SET message_id=$1, updated_at=NOW() WHERE id=$2", [messageId, log.id]);
    await finalizer.query("UPDATE guests SET whatsapp_message_id=$1 WHERE id=$2", [messageId, guestId]);
    await finalizer.query("COMMIT");
  } catch {
    await finalizer.query("ROLLBACK").catch(() => undefined);
    return json({ error: "قبل المزود الطلب لكن تعذر ربط حالة الرسالة؛ لا تعد الإرسال", code: "D360_TRACKING_FAILED", messageId, status: "queued" }, 503);
  } finally { finalizer.release(); }
  return json({ accepted: true, messageId, status: "queued", mode, deliveryConfirmed: false }, 202);
};

export const config: Config = { path: "/api/whatsapp/send" };
