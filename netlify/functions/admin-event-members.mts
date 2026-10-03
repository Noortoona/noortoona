import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { ensureAuthSchema, linkEventMember, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const db = await ensureAuthSchema();

  if (req.method === "GET") {
    const supervisors = await db.sql`
      SELECT id, name, email, phone, status
      FROM users WHERE role = 'supervisor' AND status = 'active'
      ORDER BY name ASC
    `;
    const events = await db.sql`
      SELECT id, title, occasion, event_date, location, created_at
      FROM events ORDER BY created_at DESC LIMIT 200
    `;
    const assignments = await db.sql`
      SELECT em.event_id, em.user_id, u.name AS supervisor_name
      FROM event_members em
      JOIN users u ON u.id = em.user_id
      WHERE em.member_role = 'supervisor'
    `;
    return secureJson({ supervisors, events, assignments });
  }

  if (req.method === "POST") {
    if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
    try {
      const body = await req.json();
      const eventId = String(body.eventId || "");
      const userId = String(body.userId || "");
      const action = body.action === "remove" ? "remove" : "assign";
      if (!eventId || !userId) return secureJson({ error: "المناسبة والمستخدم مطلوبان" }, 400);

      if (action === "remove") {
        await db.sql`DELETE FROM event_members WHERE event_id = ${eventId} AND user_id = ${userId} AND member_role = 'supervisor'`;
        await db.sql`UPDATE supervisor_requests SET status='requested',assigned_supervisor_id=NULL,updated_at=NOW() WHERE event_id=${eventId} AND assigned_supervisor_id=${userId} AND status='assigned'`;
        return secureJson({ ok: true });
      }

      const users = await db.sql`SELECT id, role, status FROM users WHERE id = ${userId} LIMIT 1`;
      if (!users[0] || users[0].role !== "supervisor" || users[0].status !== "active") {
        return secureJson({ error: "المستخدم المحدد ليس مشرفًا نشطًا" }, 400);
      }
      const events = await db.sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`;
      if (!events[0]) return secureJson({ error: "المناسبة غير موجودة" }, 404);
      const paid = await db.sql`SELECT 1 FROM payment_orders p JOIN supervisor_requests sr ON sr.event_id=p.event_id WHERE p.event_id=${eventId} AND p.status='paid' AND p.supervisor_addon_amount>=sr.amount AND sr.status='requested' LIMIT 1`;
      if (!paid[0]) return secureJson({ error: "يلزم دفع خدمة المشرف قبل التعيين" }, 409);
      await linkEventMember(eventId, userId, "supervisor");
      await db.sql`UPDATE supervisor_requests SET status='assigned',assigned_supervisor_id=${userId},updated_at=NOW() WHERE event_id=${eventId} AND status='requested'`;
      return secureJson({ ok: true });
    } catch (error) {
      console.error(error);
      return secureJson({ error: "تعذر تحديث تعيين المشرف" }, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = { path: "/api/admin/event-members" };
