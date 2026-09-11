import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { isSameOriginRequest, ownerTokenFrom, secureJson } from "./_shared/domain.mjs";

function inviteCode(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://noortoona.com");
    const match = url.pathname.match(/\/i\/([^/?#]+)/i);
    if (match) return decodeURIComponent(match[1]).trim().slice(0, 32);
  } catch {
    // A plain invitation code is accepted below.
  }
  return raw.replace(/^.*\/i\//i, "").split(/[?#]/)[0].trim().slice(0, 32);
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  if (Number(req.headers.get("content-length") || 0) > 16_000) return secureJson({ error: "حجم الطلب أكبر من المسموح" }, 413);

  try {
    const body: any = await req.json();
    const eventId = String(body.eventId || "").slice(0, 80);
    const ownerToken = ownerTokenFrom(req, body).slice(0, 120);
    const code = inviteCode(body.code || body.value);
    if (!eventId || !ownerToken || !code) return secureJson({ error: "بيانات المسح ناقصة" }, 400);

    const db = getDatabase();
    const [event] = await db.sql`SELECT id FROM events WHERE id=${eventId} AND owner_token=${ownerToken}`;
    if (!event) return secureJson({ error: "غير مصرح" }, 403);

    const [guest] = await db.sql`
      WITH matched AS (
        SELECT id, checked_in_at IS NOT NULL AS already_checked_in
        FROM guests
        WHERE event_id=${eventId} AND code=${code}
        FOR UPDATE
      )
      UPDATE guests AS g
      SET checked_in_at=COALESCE(g.checked_in_at, NOW())
      FROM matched
      WHERE g.id=matched.id
      RETURNING g.id, g.name, g.code, g.rsvp_status, g.companion_count, g.children_count,
                g.attendance_state, g.payment_status, g.share_total, g.checked_in_at,
                matched.already_checked_in
    `;
    if (!guest) return secureJson({ error: "هذا الرمز لا يخص ضيوف هذه المناسبة" }, 404);

    const warning = guest.attendance_state === "waitlist"
      ? "الضيف في قائمة الانتظار"
      : guest.rsvp_status !== "accepted"
        ? "الضيف لم يؤكد حضوره"
        : null;
    return secureJson({ ok: true, guest, alreadyCheckedIn: guest.already_checked_in, warning });
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر تسجيل دخول الضيف" }, 500);
  }
};

export const config: Config = { path: "/api/check-in" };
