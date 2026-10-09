import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
import { fetchMoyasarPayment, reconcileMoyasarOrder } from "./_shared/moyasar.mjs";
import { recordAcquisition } from "./_shared/partners.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  const auth = await requireRole(req, ["customer"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);

  try {
    const body: any = await req.json();
    const orderId = String(body.orderId || "");
    if (!orderId) return secureJson({ error: "رقم طلب الدفع مطلوب" }, 400);

    const db = getDatabase();
    const rows = await db.sql`
      SELECT id, event_id, user_id, package_code, amount, currency, status, referral_partner_id, commission_amount
      FROM payment_orders WHERE id=${orderId} AND user_id=${auth.user.id} LIMIT 1
    `;
    const order = rows[0];
    if (!order) return secureJson({ error: "طلب الدفع غير موجود" }, 404);
    if (order.status === "paid") { await recordAcquisition(db, order); return secureJson({ paid: true, status: "paid", order }); }

    const payment = await fetchMoyasarPayment(order.id);
    const result = await reconcileMoyasarOrder(db, order, payment);
    return secureJson({ ...result, message: payment?.message || "" });
  } catch (error: any) {
    console.error(error);
    if (error?.message === "PAYMENT_MISMATCH") return secureJson({ error: "بيانات الدفع لا تطابق الطلب", code: "PAYMENT_MISMATCH" }, 409);
    if (error?.message === "PAYMENT_VERIFY_NOT_CONFIGURED") return secureJson({ error: "مفتاح التحقق من الدفع غير مضبوط", code: error.message }, 503);
    if (error?.message === "MOYASAR_VERIFY_FAILED") return secureJson({ error: "تعذر التحقق من عملية الدفع", providerStatus: error.providerStatus }, 502);
    return secureJson({ error: "تعذر التحقق من الدفع" }, 500);
  }
};

export const config: Config = { path: "/api/payments/verify" };
