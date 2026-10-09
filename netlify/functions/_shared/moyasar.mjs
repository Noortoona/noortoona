import { moyasarFeatures } from "./payments.mjs";
import { recordAcquisition } from "./partners.mjs";

export function constantTimeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function fetchMoyasarPayment(paymentId) {
  const id = String(paymentId || "");
  if (!id) throw Object.assign(new Error("PAYMENT_ID_REQUIRED"), { status: 400 });
  const { secretKey } = moyasarFeatures();
  if (!secretKey) throw Object.assign(new Error("PAYMENT_VERIFY_NOT_CONFIGURED"), { status: 503 });

  const response = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: {
      authorization: `Basic ${btoa(`${secretKey}:`)}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Object.assign(new Error("MOYASAR_VERIFY_FAILED"), {
      status: 502,
      providerStatus: response.status,
      providerMessage: payment?.message || payment?.error || "",
    });
    throw error;
  }
  return payment;
}

export function assertPaymentMatches(order, payment) {
  const amountMatches = Number(payment?.amount) === Number(order?.amount);
  const currencyMatches = String(payment?.currency || "").toUpperCase() === String(order?.currency || "").toUpperCase();
  const idMatches = String(payment?.id || "") === String(order?.id || "");
  if (!amountMatches || !currencyMatches || !idMatches) {
    throw Object.assign(new Error("PAYMENT_MISMATCH"), { status: 409 });
  }
}

export async function reconcileMoyasarOrder(db, order, payment) {
  assertPaymentMatches(order, payment);
  const providerStatus = String(payment?.status || "").toLowerCase();
  const providerPaymentId = String(payment?.id || order.id);
  const method = String(payment?.source?.type || "");
  const message = String(payment?.message || "") || null;

  if (providerStatus === "paid") {
    const rows = await db.sql`
      UPDATE payment_orders
      SET status='paid', provider_payment_id=${providerPaymentId}, payment_method=${method || null},
          provider_message=${message}, paid_at=COALESCE(paid_at, NOW()), updated_at=NOW()
      WHERE id=${order.id}
      RETURNING id, event_id, user_id, package_code, amount, currency, status, provider_payment_id, payment_method, paid_at
    `;
    await recordAcquisition(db, order);
    return { paid: true, status: "paid", order: rows[0] };
  }

  if (providerStatus === "failed") {
    const rows = await db.sql`
      UPDATE payment_orders
      SET status='failed', provider_payment_id=${providerPaymentId}, payment_method=${method || null},
          provider_message=${message}, updated_at=NOW()
      WHERE id=${order.id}
      RETURNING id, event_id, user_id, package_code, amount, currency, status, provider_payment_id, payment_method, paid_at
    `;
    return { paid: false, status: "failed", order: rows[0] };
  }

  return { paid: false, status: providerStatus || "pending", order };
}
