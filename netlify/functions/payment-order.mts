import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { canAccessEvent, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
import { moyasarFeatures, packageFor, publicPackages } from "./_shared/payments.mjs";
import { supervisorAddonHalalas } from "./_shared/settings.mjs";
import { activePartner, normalizeReferralCode, referralAmounts } from "./_shared/partners.mjs";

async function snapshot(db: any, userId: string, eventId: string) {
  const orders = await db.sql`
    SELECT id, event_id, package_code, amount, currency, status, provider_payment_id, payment_method, referral_code, discount_amount, created_at, paid_at
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
  const request = await db.sql`SELECT status FROM supervisor_requests WHERE event_id=${eventId} AND user_id=${userId} LIMIT 1`;
  const supervisorAddonAmount = request[0] && request[0].status !== "canceled" ? await supervisorAddonHalalas(db) : 0;
  return {
    packages: publicPackages(),
    payment: orders[0] || null,
    guestCount: guestCount?.count || 0,
    freeTestUsed: Number(sentCount?.count || 0) > 0,
    paymentConfigured: features.configured,
    supervisorAddonAmount,
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
    const member = await db.sql`SELECT 1 FROM event_members WHERE event_id=${eventId} AND user_id=${auth.user.id} AND member_role='owner' LIMIT 1`;
    if (!member[0]) return secureJson({ error: "الدفع متاح لصاحب المناسبة فقط" }, 403);

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

    const requests = await db.sql`SELECT status FROM supervisor_requests WHERE event_id=${eventId} AND user_id=${auth.user.id} LIMIT 1`;
    const addon = requests[0] && requests[0].status !== 'canceled' ? await supervisorAddonHalalas(db) : 0;
    if(addon)await db.sql`UPDATE supervisor_requests SET amount=${addon},updated_at=NOW() WHERE event_id=${eventId} AND user_id=${auth.user.id} AND status IN ('requested','assigned')`;
    const rawCode = body.referralCode || '';
    const code = normalizeReferralCode(rawCode);
    if (rawCode && !code) return secureJson({ error: 'كود الإحالة غير صالح' }, 400);
    const partner = code ? await activePartner(db, code, auth.user.id) : null;
    if (code && !partner) return secureJson({ error: 'كود الإحالة غير متاح' }, 400);
    const { total, discountAmount, commissionAmount } = referralAmounts(selected.amount, addon, partner);
    if (total <= 0) return secureJson({ error: 'قيمة الطلب غير صالحة' }, 400);

    const pending = await db.sql`
      SELECT id, event_id, package_code, amount, currency, status, provider_payment_id, payment_method, referral_code, discount_amount, created_at, paid_at
      FROM payment_orders
      WHERE event_id=${eventId} AND user_id=${auth.user.id} AND package_code=${selected.code} AND amount=${total} AND referral_code IS NOT DISTINCT FROM ${partner?.code || null} AND status='pending'
      ORDER BY created_at DESC LIMIT 1
    `;
    let order = pending[0];
    if (!order || body.forceNew === true) {
      const id = crypto.randomUUID();
      const rows = await db.sql`
        INSERT INTO payment_orders (id, event_id, user_id, package_code, amount, supervisor_addon_amount, currency, referral_code, referral_partner_id, discount_amount, commission_amount)
        VALUES (${id}, ${eventId}, ${auth.user.id}, ${selected.code}, ${total}, ${addon}, ${selected.currency}, ${partner?.code || null}, ${partner?.user_id || null}, ${discountAmount}, ${commissionAmount})
        RETURNING id, event_id, package_code, amount, supervisor_addon_amount, currency, status, referral_code, discount_amount, created_at
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
