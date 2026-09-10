import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.json({ error: "الرابط غير صالح" }, { status: 400 });
  const db = getDatabase();
  const [invite] = await db.sql`
    SELECT g.id AS guest_id, g.name AS guest_name, g.rsvp_status, g.companion_count, g.children_count, g.note, g.companion_names, g.share_consent, g.share_total, g.attendance_state, g.payment_status, g.payment_amount,
           e.id AS event_id, e.title, e.occasion, e.name1, e.name2, e.event_date, e.event_time,
           e.duration_hours, e.activity_type, e.capacity, e.share_amount, e.share_label, e.require_share_consent, e.allow_named_companions, e.waitlist_enabled, e.country, e.city, e.location, e.maps_url, e.description, e.video_url, e.pdf_url, e.message, e.template, e.design_json
    FROM guests g JOIN events e ON e.id=g.event_id
    WHERE g.code=${code}
  `;
  if (!invite) return Response.json({ error: "الدعوة غير موجودة" }, { status: 404 });
  await db.sql`UPDATE guests SET viewed_at=COALESCE(viewed_at, NOW()) WHERE code=${code}`;
  return Response.json({ invite });
};

export const config: Config = { path: "/api/invite" };
