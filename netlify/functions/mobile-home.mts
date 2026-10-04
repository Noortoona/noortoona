import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { requireRole } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const auth = await requireRole(req, ["admin", "supervisor", "customer"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const db = getDatabase();

  if (auth.user.role === "admin") {
    const [eventCount] = await db.sql`SELECT COUNT(*)::int AS count FROM events`;
    const [userCount] = await db.sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'customer'`;
    const [supervisorCount] = await db.sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'supervisor'`;
    const events = await db.sql`
      SELECT id, title, occasion, event_date, event_time, city, location, created_at
      FROM events ORDER BY created_at DESC LIMIT 8
    `;
    return secureJson({
      stats: { events: eventCount?.count || 0, customers: userCount?.count || 0, supervisors: supervisorCount?.count || 0 },
      events,
    });
  }

  const events = await db.sql`
    SELECT e.id, e.title, e.occasion, e.event_date, e.event_time, e.city, e.location, e.created_at, em.member_role
    FROM event_members em
    JOIN events e ON e.id = em.event_id
    WHERE em.user_id = ${auth.user.id}
    ORDER BY e.created_at DESC
    LIMIT 30
  `;
  const [guestStats] = await db.sql`
    SELECT
      COUNT(g.id)::int AS guests,
      COUNT(g.id) FILTER (WHERE g.rsvp_status = 'accepted')::int AS accepted,
      COUNT(g.id) FILTER (WHERE g.checked_in_at IS NOT NULL)::int AS checked_in
    FROM event_members em
    JOIN guests g ON g.event_id = em.event_id
    WHERE em.user_id = ${auth.user.id}
  `;
  return secureJson({
    stats: {
      events: events.length,
      guests: guestStats?.guests || 0,
      accepted: guestStats?.accepted || 0,
      checkedIn: guestStats?.checked_in || 0,
    },
    events,
  });
};

export const config: Config = { path: "/api/mobile/home" };
