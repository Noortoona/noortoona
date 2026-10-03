import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { boundedInteger, boundedMoney, isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
import { getAuth, linkEventMember, recordAudit } from "./_shared/auth.mjs";
import { supervisorAddonHalalas } from "./_shared/settings.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  if (Number(req.headers.get("content-length") || 0) > 2_000_000) return secureJson({ error: "حجم الطلب أكبر من المسموح" }, 413);
  try {
    const data:any = await req.json();
    const auth = await getAuth(req);
    if (data.requestSupervisor && (!auth || auth.user.role !== "customer")) return secureJson({ error: "سجل دخولك برقم الجوال لإضافة مشرف للمناسبة" }, 401);
    const id = crypto.randomUUID();
    const ownerToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().slice(0, 8);
    const title = String(data.title || `${data.occasion || "مناسبة"} ${data.name1 || ""}`).trim().slice(0, 220);
    const occasion = String(data.occasion || "أخرى").trim().slice(0, 80);
    const name1 = String(data.name1 || "").trim().slice(0, 180);
    const designJson = JSON.stringify(data.design || {});
    if (!title || !name1) return secureJson({ error: "اسم المناسبة مطلوب" }, 400);
    if (designJson.length > 1_500_000) return secureJson({ error: "صورة الخلفية أكبر من المسموح" }, 413);
    const db = getDatabase();
    const [event] = await db.sql`
      INSERT INTO events (id, owner_token, title, occasion, name1, name2, event_date, event_time, duration_hours, country, city, location, maps_url, description, video_url, pdf_url, message, template, package_name, design_json, activity_type, capacity, share_amount, share_label, require_share_consent, allow_named_companions, waitlist_enabled)
      VALUES (${id}, ${ownerToken}, ${title}, ${occasion}, ${name1}, ${String(data.name2 || "").trim().slice(0, 180)}, ${data.date || null}, ${data.time || null}, ${boundedInteger(data.duration || 3, 1, 24)}, ${String(data.country || "").slice(0, 100)}, ${String(data.city || "").slice(0, 100)}, ${String(data.location || "").slice(0, 220)}, ${String(data.mapsUrl || "").slice(0, 1200)}, ${String(data.description || "").slice(0, 3000)}, ${String(data.videoUrl || "").slice(0, 1200)}, ${String(data.pdfUrl || "").slice(0, 1200)}, ${String(data.message || "").slice(0, 3000)}, ${String(data.template || "لؤلؤة").slice(0, 100)}, ${String(data.package || "الأساسية").slice(0, 60)}, ${designJson}::jsonb, ${String(data.activityType || "").slice(0, 100)}, ${data.capacity ? boundedInteger(data.capacity, 1, 500) : null}, ${boundedMoney(data.shareAmount, 100_000)}, ${String(data.shareLabel || "قيمة القطّة").slice(0, 100)}, ${Boolean(data.requireShareConsent)}, ${Boolean(data.allowNamedCompanions)}, ${Boolean(data.waitlistEnabled)})
      RETURNING id, title, occasion, name1, name2, event_date, event_time, duration_hours, country, city, location, maps_url, description, video_url, pdf_url, message, template, package_name, design_json, activity_type, capacity, share_amount, share_label, require_share_consent, allow_named_companions, waitlist_enabled, created_at
    `;
    if (auth?.user) {
      await linkEventMember(event.id, auth.user.id, "owner");
      await recordAudit(auth.user.id, "event.created", "event", event.id, { occasion: event.occasion, package: event.package_name });
      if (data.requestSupervisor) {
        const amount = await supervisorAddonHalalas(db);
        await db.sql`
          INSERT INTO supervisor_requests (id,event_id,user_id,amount,status)
          VALUES (${crypto.randomUUID()},${event.id},${auth.user.id},${amount},'requested')
          ON CONFLICT(event_id) DO UPDATE SET user_id=EXCLUDED.user_id,amount=EXCLUDED.amount,status='requested',updated_at=NOW()
        `;
        await recordAudit(auth.user.id, "supervisor.requested", "event", event.id, { amount });
      }
    }
    return secureJson({ event, ownerToken, accountLinked: Boolean(auth?.user), supervisorRequested: Boolean(data.requestSupervisor) });
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر إنشاء المناسبة" }, 500);
  }
};

export const config: Config = { path: "/api/events" };
