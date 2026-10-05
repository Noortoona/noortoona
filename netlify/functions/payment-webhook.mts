import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { secureJson } from "./_shared/domain.mjs";
import { constantTimeEqual, fetchMoyasarPayment, reconcileMoyasarOrder } from "./_shared/moyasar.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (Number(req.headers.get("content-length") || 0) > 128_000) return secureJson({ error: "Payload too large" }, 413);

  const expectedSecret = String(Netlify.env.get("MOYASAR_WEBHOOK_SECRET") || "");
  if (!expectedSecret) return secureJson({ error: "Webhook not configured" }, 503);

  try {
    const body: any = await req.json();
    if (!constantTimeEqual(body?.secret_token, expectedSecret)) return secureJson({ error: "Unauthorized" }, 401);

    const paymentId = String(body?.data?.id || "");
    if (!paymentId) return secureJson({ ok: true, ignored: true });

    const db = getDatabase();
    const rows = await db.sql`
      SELECT id, event_id, user_id, package_code, amount, currency, status, referral_partner_id, commission_amount
      FROM payment_orders WHERE id=${paymentId} LIMIT 1
    `;
    const order = rows[0];
    if (!order) return secureJson({ ok: true, ignored: true });

    const payment = await fetchMoyasarPayment(order.id);
    const result = await reconcileMoyasarOrder(db, order, payment);
    return secureJson({ ok: true, paid: result.paid, status: result.status });
  } catch (error: any) {
    console.error(error);
    if (error?.message === "PAYMENT_MISMATCH") return secureJson({ error: "Payment mismatch" }, 409);
    if (error?.message === "MOYASAR_VERIFY_FAILED") return secureJson({ error: "Provider verification failed" }, 502);
    return secureJson({ error: "Webhook processing failed" }, 500);
  }
};

export const config: Config = { path: "/api/payments/webhook" };
