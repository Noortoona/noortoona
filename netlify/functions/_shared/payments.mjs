export const PAYMENT_PACKAGES = {
  start: { code: "start", name: "البداية", guestLimit: 50, amount: 2900, currency: "SAR" },
  basic: { code: "basic", name: "الأساسية", guestLimit: 200, amount: 9900, currency: "SAR" },
  royal: { code: "royal", name: "الملكية", guestLimit: 500, amount: 14900, currency: "SAR" },
};

export function packageFor(code) {
  const raw = String(code || "");
  return PAYMENT_PACKAGES[raw] || Object.values(PAYMENT_PACKAGES).find(item => item.name === raw) || null;
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

// Disabled until a deployment explicitly selects test or approved live mode.
// Test mode never exposes a live publishable key, even if live credentials exist.
export function moyasarFeatures(get = name => Netlify.env.get(name)) {
  const mode = String(get("HALA_PAYMENT_MODE") || "disabled").toLowerCase();
  const publishableKey = String(get("MOYASAR_PUBLISHABLE_KEY") || "");
  const secretKey = String(get("MOYASAR_SECRET_KEY") || "");
  const merchantId = String(get("MOYASAR_APPLE_MERCHANT_ID") || "");
  const testKeys = /^pk_test_/.test(publishableKey) && /^sk_test_/.test(secretKey);
  const liveKeys = /^pk_live_/.test(publishableKey) && /^sk_live_/.test(secretKey);
  const liveApproved = get("HALA_LIVE_PAYMENTS_ENABLED") === "true" && get("CONTEXT") === "production";
  const configured = (mode === "test" && testKeys) || (mode === "live" && liveKeys && liveApproved);
  return {
    configured,
    mode: configured ? mode : "disabled",
    publishableKey: configured ? publishableKey : "",
    secretKey: configured ? secretKey : "",
    applePay: { enabled: configured && Boolean(merchantId), merchantId: configured ? merchantId : "" },
    stcPay: { enabled: configured && String(get("MOYASAR_STCPAY_ENABLED") || "").toLowerCase() === "true" },
  };
}
