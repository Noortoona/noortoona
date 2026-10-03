import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
import { moyasarFeatures } from "./_shared/payments.mjs";

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
      SELECT id, event_id, user_id, package_code, amount, currency, status
      FROM payment_orders WHERE id=${orderId} AND user_id=${auth.user.id} LIMIT 1
    `;
    const order = rows[0];
    if (!order) return secureJson({ error: "طلب الدفع غير موجود" }, 404);
    if (order.status === "paid") return secureJson({ paid: true, order });

    const features = moyasarFeatures();
    if (!features.secretKey) return secureJson({ error: "مفتاح التحقق من الدفع غير مضبوط", code: "PAYMENT_VERIFY_NOT_CONFIGURED" }, 503);

    const response = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(order.id)}`, {
      headers: { authorization: `Basic ${btoa(`${features.secretKey}:`)}`, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const payment: any = await response.json().catch(() => ({}));
    if (!response.ok) return secureJson({ error: "تعذر التحقق من عملية الدفع", providerStatus: response.status }, 502);

    const amountMatches = Number(payment.amount) === Number(order.amount);
    const currencyMatches = String(payment.currency || "").toUpperCase() === String(order.currency || "").toUpperCase();
    if (!amountMatches || !currencyMatches) {
      return secureJson({ error: "بيانات الدفع لا تطابق الطلب", code: "PAYMENT_MISMATCH" }, 409);
    }

    const providerStatus = String(payment.status || "");
    const method = String(payment.source?.type || "");
    if (providerStatus === "paid") {
      const paidRows = await db.sql`
        UPDATE payment_orders
        SET status='paid', provider_payment_id=${String(payment.id || order.id)}, payment_method=${method || null},
            provider_message=${String(payment.message || "") || null}, paid_at=NOW(), updated_at=NOW()
        WHERE id=${order.id}
        RETURNING id, event_id, package_code, amount, currency, status, provider_payment_id, payment_method, paid_at
      `;
      return secureJson({ paid: true, order: paidRows[0] });
    }

    if (providerStatus === "failed") {
      await db.sql`
        UPDATE payment_orders
        SET status='failed', provider_payment_id=${String(payment.id || order.id)}, payment_method=${method || null},
            provider_message=${String(payment.message || "") || null}, updated_at=NOW()
        WHERE id=${order.id}
      `;
    }

    return secureJson({ paid: false, status: providerStatus || "pending", message: payment.message || "" });
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر التحقق من الدفع" }, 500);
  }
};

export const config: Config = { path: "/api/payments/verify" };
