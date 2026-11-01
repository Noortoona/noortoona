import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { requireRole } from "./_shared/auth.mjs";
import { boundedInteger, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  try {
    const params = new URL(req.url).searchParams;
    const query = String(params.get("q") || "").trim().slice(0, 120);
    const eventId = String(params.get("eventId") || "").trim().slice(0, 80);
    const limit = boundedInteger(params.get("limit") || 50, 1, 100);
    const page = boundedInteger(params.get("page") || 1, 1, 1000);
    const offset = (page - 1) * limit;
    const db = getDatabase();
    const rows = await db.sql`
      SELECT e.id,e.title,e.occasion,e.city,e.location,e.maps_url,e.event_date,e.event_time,e.created_at,
        (SELECT u.name FROM event_members em JOIN users u ON u.id=em.user_id
         WHERE em.event_id=e.id AND em.member_role='owner' ORDER BY u.created_at,u.id LIMIT 1) AS owner_name,
        COUNT(g.id)::int AS guest_count,
        COUNT(g.id) FILTER(WHERE g.rsvp_status='accepted')::int AS accepted,
        COUNT(g.id) FILTER(WHERE g.rsvp_status='declined')::int AS declined,
        COUNT(g.id) FILTER(WHERE g.attendance_state='waitlist')::int AS waitlisted,
        COUNT(g.id) FILTER(WHERE g.checked_in_at IS NOT NULL)::int AS checked_in,
        COUNT(g.id) FILTER(WHERE g.whatsapp_status='delivered')::int AS delivered,
        COUNT(g.id) FILTER(WHERE g.whatsapp_status='read')::int AS read,
        COUNT(g.id) FILTER(WHERE g.whatsapp_status='failed')::int AS failed
      FROM events e LEFT JOIN guests g ON g.event_id=e.id
      WHERE (${eventId}='' OR e.id=${eventId})
        AND (${query}='' OR e.title ILIKE ${'%' + query + '%'} OR e.city ILIKE ${'%' + query + '%'})
      GROUP BY e.id ORDER BY e.created_at DESC,e.id
      LIMIT ${eventId ? 1 : limit + 1} OFFSET ${eventId ? 0 : offset}
    `;
    if (eventId) {
      if (!rows[0]) return secureJson({ error: "المناسبة غير موجودة" }, 404);
      return secureJson({ event: rows[0] });
    }
    return secureJson({ events: rows.slice(0, limit), page, limit, hasMore: rows.length > limit });
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر تحميل المناسبات" }, 500);
  }
};

export const config: Config = { path: "/api/admin/events" };
