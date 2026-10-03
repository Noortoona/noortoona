import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { linkEventMember, requireRole } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  try {
    const body = await req.json();
    const eventId = String(body.eventId || "");
    const userId = String(body.userId || "");
    if (!eventId || !userId) return secureJson({ error: "المناسبة والمستخدم مطلوبان" }, 400);
    const db = getDatabase();
    const users = await db.sql`SELECT id, role, status FROM users WHERE id = ${userId} LIMIT 1`;
    if (!users[0] || users[0].role !== "supervisor" || users[0].status !== "active") {
      return secureJson({ error: "المستخدم المحدد ليس مشرفًا نشطًا" }, 400);
    }
    const events = await db.sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`;
    if (!events[0]) return secureJson({ error: "المناسبة غير موجودة" }, 404);
    await linkEventMember(eventId, userId, "supervisor");
    return secureJson({ ok: true });
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر تعيين المشرف" }, 500);
  }
};

export const config: Config = { path: "/api/admin/event-members" };
