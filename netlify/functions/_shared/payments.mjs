export const PAYMENT_PACKAGES = {
  start: { code: "start", name: "البداية", guestLimit: 50, amount: 2900, currency: "SAR" },
  basic: { code: "basic", name: "الأساسية", guestLimit: 200, amount: 9900, currency: "SAR" },
  royal: { code: "royal", name: "الملكية", guestLimit: 500, amount: 14900, currency: "SAR" },
};

export function packageFor(code) {
  return PAYMENT_PACKAGES[String(code || "")] || null;
}

export function publicPackages() {
  return Object.values(PAYMENT_PACKAGES).map((item) => ({
    code: item.code,
    name: item.name,
    guestLimit: item.guestLimit,
    amount: item.amount,
    amountSar: item.amount / 100,
    currency: item.currency,
  }));
}

export function moyasarFeatures() {
  const publishableKey = String(Netlify.env.get("MOYASAR_PUBLISHABLE_KEY") || "");
  const secretKey = String(Netlify.env.get("MOYASAR_SECRET_KEY") || "");
  const merchantId = String(Netlify.env.get("MOYASAR_APPLE_MERCHANT_ID") || "");
  const stcPayEnabled = String(Netlify.env.get("MOYASAR_STCPAY_ENABLED") || "").toLowerCase() === "true";
  return {
    configured: Boolean(publishableKey && secretKey),
    publishableKey,
    secretKey,
    applePay: { enabled: Boolean(merchantId), merchantId },
    stcPay: { enabled: stcPayEnabled },
  };
}
