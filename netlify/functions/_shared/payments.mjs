// New package codes deliberately differ from legacy start/basic/royal orders.
// Previously paid order amounts and package identifiers remain unchanged in the database.
export const PAYMENT_PACKAGES = {
  hala_basic: { code: "hala_basic", name: "هلا الأساسية", guestLimit: 100, amount: 44900, currency: "SAR" },
  hala_plus: { code: "hala_plus", name: "هلا بلس", guestLimit: 250, amount: 109900, currency: "SAR" },
  hala_premium: { code: "hala_premium", name: "هلا بريميوم", guestLimit: 500, amount: 179900, currency: "SAR" },
};

// Historical paid orders retain their original guest limits; never offer these codes for new purchases.
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

// Reference prices are exposed only after actual prior sales and the license are verified.
const REFERENCE_PRICES={hala_basic:89900,hala_plus:219900,hala_premium:359900};
function verifiedPromotion(){
  return typeof Netlify!=="undefined" && Netlify.env && String(Netlify.env.get("HALA_PROMO_LICENSE_ID")||"").trim() && String(Netlify.env.get("HALA_PROMO_PRIOR_PRICES_VERIFIED")).toLowerCase()==="true";
}
export function publicPackages() {
  const promotionActive=verifiedPromotion();
  return Object.values(PAYMENT_PACKAGES).map((item) => ({
    code: item.code,
    name: item.name,
    guestLimit: item.guestLimit,
    amount: item.amount,
    amountSar: item.amount / 100,
    ...(promotionActive&&REFERENCE_PRICES[item.code]>item.amount?{
      referenceAmount:REFERENCE_PRICES[item.code],referenceAmountSar:REFERENCE_PRICES[item.code]/100,
      savingsPercent:Math.round((1-item.amount/REFERENCE_PRICES[item.code])*100),
      promoLicenseId:String(Netlify.env.get("HALA_PROMO_LICENSE_ID")).trim(),
    }:{}),
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
