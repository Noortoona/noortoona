// New purchase codes; retain legacy plan limits separately for historic paid orders.
export const PAYMENT_PACKAGES = {
  hala_basic: { code: "hala_basic", name: "هلا الأساسية", guestLimit: 100, amount: 44900, currency: "SAR" },
  hala_plus: { code: "hala_plus", name: "هلا بلس", guestLimit: 250, amount: 109900, currency: "SAR" },
  hala_premium: { code: "hala_premium", name: "هلا بريميوم", guestLimit: 500, amount: 179900, currency: "SAR" },
};
const LEGACY_PAYMENT_PACKAGES = {
  start: { code: "start", name: "البداية (سابقة)", guestLimit: 50, amount: 2900, currency: "SAR" },
  basic: { code: "basic", name: "الأساسية (سابقة)", guestLimit: 200, amount: 9900, currency: "SAR" },
  royal: { code: "royal", name: "الملكية (سابقة)", guestLimit: 500, amount: 14900, currency: "SAR" },
};
export function packageForPaidOrder(code) {
  const raw = String(code || "");
  return PAYMENT_PACKAGES[raw] || LEGACY_PAYMENT_PACKAGES[raw] || null;
}

export function packageFor(code) {
  const raw = String(code || "");
  return PAYMENT_PACKAGES[raw] || Object.values(PAYMENT_PACKAGES).find(item => item.name === raw) || null;
}

// Comparison prices are NOT past transacted prices. A crossed-out price is forbidden
// until the actual prior sales and a valid promotional license have been verified.
const REFERENCE_PRICES = { hala_basic: 89900, hala_plus: 219900, hala_premium: 359900 };
function verifiedPromotion() {
  if (typeof Netlify === "undefined" || !Netlify.env) return false;
  return Boolean(
    Netlify.env.get("HALA_PROMO_LICENSE_ID") &&
    String(Netlify.env.get("HALA_PROMO_PRIOR_PRICES_VERIFIED")).toLowerCase() === "true"
  );
}
export function publicPackages() {
  const promotionActive = verifiedPromotion();
  return Object.values(PAYMENT_PACKAGES).map((item) => ({
    code: item.code,
    name: item.name,
    guestLimit: item.guestLimit,
    amount: item.amount,
    amountSar: item.amount / 100,
    ...(promotionActive ? {
      referenceAmount: REFERENCE_PRICES[item.code],
      referenceAmountSar: REFERENCE_PRICES[item.code] / 100,
      savingsPercent: Math.round((1 - item.amount / REFERENCE_PRICES[item.code]) * 100),
      promoLicenseId: String(Netlify.env.get("HALA_PROMO_LICENSE_ID")),
    } : {}),
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
