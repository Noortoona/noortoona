import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const data = await req.json();
    const id = crypto.randomUUID();
    const ownerToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().slice(0, 8);
    const title = String(data.title || `${data.occasion || "مناسبة"} ${data.name1 || ""}`).trim();
    const db = getDatabase();
    const [event] = await db.sql`
      INSERT INTO events (id, owner_token, title, occasion, name1, name2, event_date, event_time, duration_hours, country, city, location, maps_url, description, video_url, pdf_url, message, template, package_name, design_json, activity_type, capacity, share_amount, share_label, require_share_consent, allow_named_companions, waitlist_enabled)
      VALUES (${id}, ${ownerToken}, ${title}, ${String(data.occasion || "أخرى")}, ${String(data.name1 || "")}, ${String(data.name2 || "")}, ${data.date || null}, ${data.time || null}, ${Math.max(1, Math.min(24, Number(data.duration || 3)))}, ${String(data.country || "")}, ${String(data.city || "")}, ${String(data.location || "")}, ${String(data.mapsUrl || "")}, ${String(data.description || "")}, ${String(data.videoUrl || "")}, ${String(data.pdfUrl || "")}, ${String(data.message || "")}, ${String(data.template || "لؤلؤة")}, ${String(data.package || "الأساسية")}, ${JSON.stringify(data.design || {})}::jsonb, ${String(data.activityType || "")}, ${data.capacity ? Math.max(1, Math.min(500, Number(data.capacity))) : null}, ${Math.max(0, Number(data.shareAmount || 0))}, ${String(data.shareLabel || "قيمة القطّة")}, ${Boolean(data.requireShareConsent)}, ${Boolean(data.allowNamedCompanions)}, ${Boolean(data.waitlistEnabled)})
      RETURNING id, title, occasion, name1, name2, event_date, event_time, duration_hours, country, city, location, maps_url, description, video_url, pdf_url, message, template, package_name, design_json, activity_type, capacity, share_amount, share_label, require_share_consent, allow_named_companions, waitlist_enabled, created_at
    `;
    return Response.json({ event, ownerToken });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "تعذر إنشاء المناسبة" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/events" };
