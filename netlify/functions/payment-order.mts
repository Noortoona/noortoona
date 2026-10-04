import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { canAccessEvent, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
import { moyasarFeatures, packageFor, publicPackages } from "./_shared/payments.mjs";

async function snapshot(db: any, userId: string, eventId: string) {
  const orders = await db.sql`
    SELECT id, event_id, package_code, amount, currency, status, provider_payment_id, payment_method, created_at, paid_at
    FROM payment_orders
    WHERE event_id=${eventId} AND user_id=${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const [guestCount] = await db.sql`SELECT COUNT(*)::int AS count FROM guests WHERE event_id=${eventId}`;
  const [sentCount] = await db.sql`
    SELECT COUNT(*)::int AS count
    FROM whatsapp_messages
    WHERE event_id=${eventId} AND status IN ('queued','sent','delivered','read')
  `;
  const features = moyasarFeatures();
  return {
    packages: publicPackages(),
    payment: orders[0] || null,
    guestCount: guestCount?.count || 0,
    freeTestUsed: Number(sentCount?.count || 0) > 0,
    paymentConfigured: features.configured,
    features: {
      applePay: { enabled: features.applePay.enabled, merchantId: features.applePay.merchantId || null },
      stcPay: { enabled: features.stcPay.enabled },
      card: { enabled: true },
    },
  };
}

export default async (req: Request) => {
  const auth = await requireRole(req, ["customer"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const db = getDatabase();

  if (req.method === "GET") {
    const eventId = String(new URL(req.url).searchParams.get("eventId") || "");
    if (!eventId || !await canAccessEvent(auth.user, eventId)) return secureJson({ error: "غير مصرح" }, 403);
    return secureJson(await snapshot(db, auth.user.id, eventId));
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);

  try {
    const body: any = await req.json();
    const eventId = String(body.eventId || "");
    const selected = packageFor(body.packageCode);
    if (!eventId || !selected) return secureJson({ error: "اختر باقة صحيحة" }, 400);
    if (!await canAccessEvent(auth.user, eventId)) return secureJson({ error: "غير مصرح" }, 403);

    const features = moyasarFeatures();
    if (!features.configured) return secureJson({ error: "إعدادات الدفع غير مكتملة بعد", code: "PAYMENT_NOT_CONFIGURED" }, 503);

    const [guestCount] = await db.sql`SELECT COUNT(*)::int AS count FROM guests WHERE event_id=${eventId}`;
    if (Number(guestCount?.count || 0) > selected.guestLimit) {
      return secureJson({ error: `عدد الضيوف يتجاوز حد باقة ${selected.name}` }, 409);
    }

    const paid = await db.sql`
      SELECT id, event_id, package_code, amount, currency, status, provider_payment_id, payment_method, created_at, paid_at
      FROM payment_orders WHERE event_id=${eventId} AND user_id=${auth.user.id} AND status='paid' LIMIT 1
    `;
    if (paid[0]) return secureJson({ order: paid[0], publishableKey: features.publishableKey, alreadyPaid: true, features: { applePay: features.applePay, stcPay: features.stcPay } });

    const pending = await db.sql`
      SELECT id, event_id, package_code, amount, currency, status, provider_payment_id, payment_method, created_at, paid_at
      FROM payment_orders
      WHERE event_id=${eventId} AND user_id=${auth.user.id} AND package_code=${selected.code} AND status='pending'
      ORDER BY created_at DESC LIMIT 1
    `;
    let order = pending[0];
    if (!order || body.forceNew === true) {
      const id = crypto.randomUUID();
      const rows = await db.sql`
        INSERT INTO payment_orders (id, event_id, user_id, package_code, amount, currency)
        VALUES (${id}, ${eventId}, ${auth.user.id}, ${selected.code}, ${selected.amount}, ${selected.currency})
        RETURNING id, event_id, package_code, amount, currency, status, created_at
      `;
      order = rows[0];
    }

    return secureJson({
      order,
      publishableKey: features.publishableKey,
      features: {
        applePay: { enabled: features.applePay.enabled, merchantId: features.applePay.merchantId || null },
        stcPay: { enabled: features.stcPay.enabled },
      },
    }, 201);
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر تجهيز عملية الدفع" }, 500);
  }
};

export const config: Config = { path: "/api/payments/order" };
