import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { requireRole, recordAudit } from "./_shared/auth.mjs";
import { boundedInteger, isSameOriginRequest, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const db = getDatabase();
  try {
    if (req.method === "PATCH") {
      if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
      const body: any = await req.json();
      const id = String(body.id || "").slice(0, 100);
      const status = String(body.status || "");
      const notes = String(body.staffNotes ?? "").trim().slice(0, 2000);
      const allowed = ["pending_contact","contacted","awaiting_payment","canceled","confirmed","completed"];
      if (!id || !allowed.includes(status)) return secureJson({ error: "بيانات غير صالحة" }, 400);
      // Paid/confirmed cannot be impersonated by a staff update.
      const updated = await db.sql`
        UPDATE booking_requests
        SET status=${status},staff_notes=${notes},updated_at=NOW(),
          last_contacted_at=CASE WHEN ${status} IN ('contacted','awaiting_payment') THEN NOW() ELSE last_contacted_at END
        WHERE id=${id} AND (${status} NOT IN ('confirmed','completed') OR payment_status='paid')
        RETURNING id,status,payment_status,staff_notes
      `;
      if (!updated[0]) return secureJson({ error: "تعذر تحديث الحجز أو لم يُتحقق من الدفع" }, 409);
      await recordAudit(auth.user.id, "booking.followup_updated", "booking", id, { status });
      return secureJson({ booking: updated[0] });
    }
    if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    const params = new URL(req.url).searchParams;
    const q = String(params.get("q") || "").trim().slice(0, 100);
    const page = boundedInteger(params.get("page") || 1, 1, 10000);
    const limit = boundedInteger(params.get("limit") || 30, 1, 100);
    const offset = (page - 1) * limit;
    const [rows,counts] = await Promise.all([
      db.sql`
        SELECT b.id,b.booking_code,b.amount,b.discount_amount,b.currency,b.status,b.payment_status,
          b.package_code,b.package_name,b.guest_limit,b.referral_code,b.staff_notes,b.last_contacted_at,b.created_at,
          e.id AS event_id,e.title,e.occasion,e.event_date,e.city,u.name AS customer_name,u.phone AS customer_phone,
          (SELECT COUNT(*)::int FROM guests g WHERE g.event_id=e.id) AS guest_count,
          (SELECT n.status FROM booking_notifications n WHERE n.booking_id=b.id AND n.channel='email') AS email_status,
          (SELECT n.status FROM booking_notifications n WHERE n.booking_id=b.id AND n.channel='whatsapp') AS whatsapp_status
        FROM booking_requests b JOIN events e ON e.id=b.event_id JOIN users u ON u.id=b.customer_user_id
        WHERE (${q}='' OR b.booking_code ILIKE ${'%'+q+'%'} OR u.name ILIKE ${'%'+q+'%'} OR u.phone ILIKE ${'%'+q+'%'} OR e.title ILIKE ${'%'+q+'%'})
        ORDER BY b.created_at DESC,b.id
        LIMIT ${limit+1} OFFSET ${offset}
      `,
      db.sql`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='pending_contact')::int AS new_count,
          COUNT(*) FILTER (WHERE payment_status='pending_payment')::int AS pending_payment,
          COUNT(*) FILTER (WHERE payment_status='paid')::int AS paid_count,
          COALESCE(SUM(amount) FILTER (WHERE payment_status='pending_payment' AND status<>'canceled'),0)::bigint AS potential_amount,
          COALESCE(SUM(amount) FILTER (WHERE payment_status='paid'),0)::bigint AS paid_amount
        FROM booking_requests
      `
    ]);
    return secureJson({ bookings: rows.slice(0,limit), page, hasMore: rows.length > limit,
      stats: counts[0] || {total:0,new_count:0,pending_payment:0,paid_count:0,potential_amount:0,paid_amount:0} });
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر تحميل الحجوزات" }, 500);
  }
};
export const config: Config = { path: "/api/admin/bookings" };
