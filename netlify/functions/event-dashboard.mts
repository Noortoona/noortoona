import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const url = new URL(req.url);
  const eventId = url.searchParams.get("event");
  const token = url.searchParams.get("token");
  if (!eventId || !token) return Response.json({ error: "بيانات الدخول ناقصة" }, { status: 400 });
  const db = getDatabase();
  const [event] = await db.sql`
    SELECT id, title, occasion, name1, name2, event_date, event_time, duration_hours, activity_type, capacity, share_amount, share_label, require_share_consent, allow_named_companions, waitlist_enabled, country, city, location, maps_url, description, video_url, pdf_url, message, template, package_name, design_json, created_at
    FROM events WHERE id=${eventId} AND owner_token=${token}
  `;
  if (!event) return Response.json({ error: "غير مصرح" }, { status: 403 });
  const guests = await db.sql`
    SELECT id, name, phone, code, viewed_at, rsvp_status, companion_count, children_count, note, companion_names, share_consent, share_total, attendance_state, payment_status, payment_amount, paid_at, responded_at,
           whatsapp_message_id, whatsapp_status, whatsapp_sent_at, whatsapp_delivered_at, whatsapp_read_at, whatsapp_failed_at, whatsapp_error, created_at
    FROM guests WHERE event_id=${eventId} ORDER BY created_at DESC
  `;
  return Response.json({ event, guests });
};

export const config: Config = { path: "/api/dashboard" };
