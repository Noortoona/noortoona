import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { requireRole } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const auth = await requireRole(req, ["partner"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const db = getDatabase();
  const profiles = await db.sql`SELECT kind,code,status,commission_bps,discount_bps FROM partner_profiles WHERE user_id=${auth.user.id} LIMIT 1`;
  if (!profiles[0]) return secureJson({ error: "حساب الشريك غير مكتمل" }, 404);
  const summary = await db.sql`
    SELECT COUNT(*)::int customers,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','approved')),0)::bigint due,
      COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)::bigint paid
    FROM partner_commissions WHERE partner_user_id=${auth.user.id}
  `;
  const commissions = await db.sql`
    SELECT created_at,amount,status FROM partner_commissions
    WHERE partner_user_id=${auth.user.id} ORDER BY created_at DESC LIMIT 50
  `;
  return secureJson({ profile: profiles[0], summary: summary[0], commissions });
};
export const config: Config = { path: "/api/partner/home" };
