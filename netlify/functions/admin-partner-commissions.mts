import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { recordAudit, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "PATCH") return new Response("Method Not Allowed", { status: 405 });
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  try {
    const body: any = await req.json();
    const id = String(body.id || "");
    const status = body.status === "approved" || body.status === "paid" || body.status === "void" ? body.status : "";
    if (!id || !status) return secureJson({ error: "بيانات العمولة غير صالحة" }, 400);
    const db = getDatabase();
    const rows = await db.sql`
      UPDATE partner_commissions SET status=${status},paid_at=CASE WHEN ${status}='paid' THEN NOW() ELSE NULL END
      WHERE id=${id} AND status IN ('pending','approved')
      RETURNING id,partner_user_id,amount,status,paid_at
    `;
    if (!rows[0]) return secureJson({ error: "العمولة غير متاحة للتحديث" }, 409);
    await recordAudit(auth.user.id,"partner.commission_status","commission",id,{status,amount:rows[0].amount});
    return secureJson({ commission: rows[0] });
  } catch (error) { console.error(error); return secureJson({ error: "تعذر تحديث العمولة" }, 500); }
};
export const config: Config = { path: "/api/admin/partner-commissions" };
