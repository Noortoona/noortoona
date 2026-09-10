import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const data = await req.json();
    const allowed = new Set(["accepted", "declined", "maybe"]);
    const status = allowed.has(String(data.status)) ? String(data.status) : null;
    const companions = Math.max(0, Math.min(20, Number(data.companionCount || 0)));
    const children = Math.max(0, Math.min(20, Number(data.childrenCount || 0)));
    const note = String(data.note || "").slice(0, 500);
    const companionNames = Array.isArray(data.companionNames) ? data.companionNames.slice(0, companions).map((x:any)=>String(x||"").trim().slice(0,80)) : [];
    const shareConsent = Boolean(data.shareConsent);
    if (!data.code || !status) return Response.json({ error: "الرد غير صالح" }, { status: 400 });
    const db = getDatabase();
    const [eventInfo] = await db.sql`SELECT g.id AS guest_id, g.event_id, e.share_amount, e.require_share_consent, e.allow_named_companions, e.capacity, e.waitlist_enabled, e.occasion FROM guests g JOIN events e ON e.id=g.event_id WHERE g.code=${String(data.code)}`;
    if (!eventInfo) return Response.json({ error: "الدعوة غير موجودة" }, { status: 404 });
    if (status === "accepted" && eventInfo.require_share_consent && !shareConsent) return Response.json({ error: "يلزم الموافقة على قيمة القطّة" }, { status: 400 });
    if (status === "accepted" && eventInfo.allow_named_companions && companions > 0 && companionNames.length !== companions) return Response.json({ error: "أدخل أسماء جميع المرافقين" }, { status: 400 });
    const partySize = 1 + companions + children;
    let attendanceState = "normal";
    if (status === "accepted" && eventInfo.occasion === "تجمع ونشاط" && Number(eventInfo.capacity || 0) > 0) {
      const [usage] = await db.sql`
        SELECT COALESCE(SUM(1 + companion_count + children_count),0)::int AS used
        FROM guests
        WHERE event_id=${eventInfo.event_id} AND id<>${eventInfo.guest_id}
          AND rsvp_status='accepted' AND attendance_state='normal'
      `;
      const used = Number(usage?.used || 0);
      if (used + partySize > Number(eventInfo.capacity)) {
        if (eventInfo.waitlist_enabled) attendanceState = "waitlist";
        else return Response.json({ error: "اكتمل العدد المتاح لهذا النشاط" }, { status: 409 });
      }
    }
    const shareTotal = status === "accepted" ? Number(eventInfo.share_amount || 0) * (1 + companions) : 0;
    const [guest] = await db.sql`
      UPDATE guests
      SET rsvp_status=${status}, companion_count=${status === "accepted" ? companions : 0}, children_count=${status === "accepted" ? children : 0}, note=${note}, companion_names=${JSON.stringify(companionNames)}::jsonb, share_consent=${status === "accepted" ? shareConsent : false}, share_total=${shareTotal}, attendance_state=${status === "accepted" ? attendanceState : "normal"}, payment_status=CASE WHEN ${status}='accepted' THEN payment_status ELSE 'unpaid' END, payment_amount=CASE WHEN ${status}='accepted' THEN payment_amount ELSE 0 END, paid_at=CASE WHEN ${status}='accepted' THEN paid_at ELSE NULL END, responded_at=NOW()
      WHERE code=${String(data.code)}
      RETURNING name, rsvp_status, companion_count, children_count, note, companion_names, share_consent, share_total, attendance_state, payment_status, payment_amount, responded_at
    `;
    if (!guest) return Response.json({ error: "الدعوة غير موجودة" }, { status: 404 });
    return Response.json({ guest });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "تعذر تسجيل الرد" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/rsvp" };
