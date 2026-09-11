import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { boundedInteger, calculateShareTotal, decideAttendance, isSameOriginRequest, partySize, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 32_000) return secureJson({ error: "حجم الطلب أكبر من المسموح" }, 413);
  try {
    const data = await req.json();
    const allowed = new Set(["accepted", "declined", "maybe"]);
    const status = allowed.has(String(data.status)) ? String(data.status) : null;
    const companions = boundedInteger(data.companionCount, 0, 20);
    const children = boundedInteger(data.childrenCount, 0, 20);
    const note = String(data.note || "").slice(0, 500);
    const companionNames = Array.isArray(data.companionNames) ? data.companionNames.slice(0, companions).map((x:any)=>String(x||"").trim().slice(0,80)) : [];
    const shareConsent = Boolean(data.shareConsent);
    if (!data.code || !status) return secureJson({ error: "الرد غير صالح" }, 400);
    const db = getDatabase();
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const eventResult = await client.query(
        `SELECT g.id AS guest_id, g.event_id, g.share_total AS previous_share_total,
                e.share_amount, e.require_share_consent, e.allow_named_companions,
                e.capacity, e.waitlist_enabled, e.occasion
         FROM guests g JOIN events e ON e.id=g.event_id
         WHERE g.code=$1 FOR UPDATE OF e, g`,
        [String(data.code).slice(0, 32)]
      );
      const eventInfo = eventResult.rows[0];
      if (!eventInfo) {
        await client.query("ROLLBACK");
        return secureJson({ error: "الدعوة غير موجودة" }, 404);
      }
      if (status === "accepted" && eventInfo.require_share_consent && !shareConsent) {
        await client.query("ROLLBACK");
        return secureJson({ error: "يلزم الموافقة على قيمة القطّة" }, 400);
      }
      if (status === "accepted" && eventInfo.allow_named_companions && companions > 0 && (companionNames.length !== companions || companionNames.some((name:string)=>!name))) {
        await client.query("ROLLBACK");
        return secureJson({ error: "أدخل أسماء جميع المرافقين" }, 400);
      }

      let attendanceState = "normal";
      if (status === "accepted" && eventInfo.occasion === "تجمع ونشاط" && Number(eventInfo.capacity || 0) > 0) {
        const usageResult = await client.query(
          `SELECT COALESCE(SUM(1 + companion_count + children_count),0)::int AS used
           FROM guests
           WHERE event_id=$1 AND id<>$2 AND rsvp_status='accepted' AND attendance_state='normal'`,
          [eventInfo.event_id, eventInfo.guest_id]
        );
        attendanceState = decideAttendance({
          used: Number(usageResult.rows[0]?.used || 0),
          capacity: Number(eventInfo.capacity),
          requested: partySize(companions, children),
          waitlistEnabled: Boolean(eventInfo.waitlist_enabled),
        });
        if (attendanceState === "full") {
          await client.query("ROLLBACK");
          return secureJson({ error: "اكتمل العدد المتاح لهذا النشاط" }, 409);
        }
      }

      const shareTotal = calculateShareTotal(eventInfo.share_amount, companions, status === "accepted");
      const preservePayment = status === "accepted" && Number(eventInfo.previous_share_total || 0) === shareTotal;
      const updateResult = await client.query(
        `UPDATE guests
         SET rsvp_status=$1, companion_count=$2, children_count=$3, note=$4,
             companion_names=$5::jsonb, share_consent=$6, share_total=$7,
             attendance_state=$8,
             payment_status=CASE WHEN $9 THEN payment_status ELSE 'unpaid' END,
             payment_amount=CASE WHEN $9 THEN payment_amount ELSE 0 END,
             paid_at=CASE WHEN $9 THEN paid_at ELSE NULL END,
             responded_at=NOW()
         WHERE code=$10
         RETURNING name, rsvp_status, companion_count, children_count, note, companion_names,
                   share_consent, share_total, attendance_state, payment_status, payment_amount, responded_at`,
        [
          status,
          status === "accepted" ? companions : 0,
          status === "accepted" ? children : 0,
          note,
          JSON.stringify(status === "accepted" ? companionNames : []),
          status === "accepted" ? shareConsent : false,
          shareTotal,
          status === "accepted" ? attendanceState : "normal",
          preservePayment,
          String(data.code).slice(0, 32),
        ]
      );
      await client.query("COMMIT");
      return secureJson({ guest: updateResult.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر تسجيل الرد" }, 500);
  }
};

export const config: Config = { path: "/api/rsvp" };
