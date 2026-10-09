import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { recordAudit, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, normalizePhone, secureJson } from "./_shared/domain.mjs";
import { normalizeReferralCode } from "./_shared/partners.mjs";

export default async (req: Request) => {
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const db = getDatabase();
  if (req.method === "GET") {
    const partners = await db.sql`
      SELECT p.user_id,p.kind,p.code,p.status,p.commission_bps,p.discount_bps,u.name,u.phone,
        COUNT(c.id)::int AS customers,
        COALESCE(SUM(c.amount) FILTER (WHERE c.status IN ('pending','approved')),0)::bigint AS commission_due,
        COALESCE(SUM(c.amount) FILTER (WHERE c.status='paid'),0)::bigint AS commission_paid
      FROM partner_profiles p JOIN users u ON u.id=p.user_id
      LEFT JOIN partner_commissions c ON c.partner_user_id=p.user_id
      GROUP BY p.user_id,p.kind,p.code,p.status,p.commission_bps,p.discount_bps,u.name,u.phone
      ORDER BY u.name
    `;
    const commissions = await db.sql`
      SELECT c.id,c.amount,c.status,c.created_at,c.paid_at,p.code,u.name partner_name,
        customer.name customer_name,o.id order_id,o.amount order_amount
      FROM partner_commissions c JOIN partner_profiles p ON p.user_id=c.partner_user_id
      JOIN users u ON u.id=p.user_id JOIN users customer ON customer.id=c.customer_user_id
      JOIN payment_orders o ON o.id=c.order_id ORDER BY c.created_at DESC LIMIT 100
    `;
    return secureJson({ partners, commissions });
  }
  if (req.method !== "POST" && req.method !== "PATCH") return new Response("Method Not Allowed", { status: 405 });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  try {
    const body: any = await req.json();
    if (req.method === "POST") {
      const name = String(body.name || "").trim().slice(0, 120);
      const phone = normalizePhone(body.phone || "");
      const code = normalizeReferralCode(body.code);
      const kind = body.kind === "influencer" ? "influencer" : "venue";
      if (name.length < 2 || !/^9665\d{8}$/.test(phone) || !code) return secureJson({ error: "تحقق من اسم الشريك والجوال والكود" }, 400);
      const existing = await db.sql`SELECT id,role FROM users WHERE phone=${phone} LIMIT 1`;
      if (existing[0] && !["partner"].includes(existing[0].role)) return secureJson({ error: "هذا الرقم مرتبط بحساب من نوع آخر" }, 409);
      const users = await db.sql`
        INSERT INTO users(id,name,phone,role) VALUES (${crypto.randomUUID()},${name},${phone},'partner')
        ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,updated_at=NOW()
        RETURNING id
      `;
      const id = users[0].id;
      const rates = kind === "influencer" ? 1000 : 0;
      const profiles = await db.sql`
        INSERT INTO partner_profiles(user_id,kind,code,commission_bps,discount_bps)
        VALUES (${id},${kind},${code},1000,${rates})
        ON CONFLICT(user_id) DO UPDATE SET kind=EXCLUDED.kind,code=EXCLUDED.code,
          discount_bps=EXCLUDED.discount_bps,updated_at=NOW()
        RETURNING user_id,kind,code,status
      `;
      await recordAudit(auth.user.id,"partner.upsert","partner",id,{kind,code});
      return secureJson({ partner: profiles[0] }, 201);
    }
    const id = String(body.userId || "");
    const status = body.status === "paused" ? "paused" : body.status === "active" ? "active" : "";
    if (!id || !status) return secureJson({ error: "حالة الشريك غير صالحة" }, 400);
    const rows = await db.sql`UPDATE partner_profiles SET status=${status},updated_at=NOW() WHERE user_id=${id} RETURNING user_id,status`;
    if (!rows[0]) return secureJson({ error: "الشريك غير موجود" }, 404);
    await recordAudit(auth.user.id,"partner.status","partner",id,{status});
    return secureJson({ partner: rows[0] });
  } catch (error: any) {
    if (error?.code === "23505") return secureJson({ error: "الكود أو رقم الجوال مستخدم مسبقًا" }, 409);
    console.error(error); return secureJson({ error: "تعذر حفظ الشريك" }, 500);
  }
};
export const config: Config = { path: "/api/admin/partners" };
