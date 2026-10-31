import test from "node:test";
import assert from "node:assert/strict";
import { packageFor, publicPackages } from "../netlify/functions/_shared/payments.mjs";

test("Hala packages have server-owned prices and guest limits", () => {
  assert.deepEqual(publicPackages().map(p => [p.code, p.amount, p.guestLimit]), [
    ["hala_basic", 14900, 100],
    ["hala_plus", 34900, 250],
    ["hala_premium", 69900, 500],
  ]);
  assert.equal(packageFor("hala_plus")?.currency, "SAR");
  assert.equal(packageFor("basic"), null, "legacy package codes cannot create newly priced orders");
  assert.equal(packageFor("هلا بريميوم")?.amount, 69900);
  assert.equal(packageFor("unknown"), null);
});

import { moyasarFeatures } from "../netlify/functions/_shared/payments.mjs";
const features = env => moyasarFeatures(name => env[name]);
const testCredentials = { MOYASAR_PUBLISHABLE_KEY: "pk_test_synthetic", MOYASAR_SECRET_KEY: "sk_test_synthetic" };
const liveCredentials = { MOYASAR_PUBLISHABLE_KEY: "pk_live_synthetic", MOYASAR_SECRET_KEY: "sk_live_synthetic" };

test("payment remains disabled by default even when credentials are present", () => {
  for (const keys of [testCredentials, liveCredentials]) {
    const result = features({ ...keys, MOYASAR_APPLE_MERCHANT_ID: "merchant.test", MOYASAR_STCPAY_ENABLED: "true" });
    assert.equal(result.configured, false);
    assert.equal(result.mode, "disabled");
    assert.equal(result.publishableKey, "");
    assert.equal(result.secretKey, "");
    assert.equal(result.applePay.enabled, false);
    assert.equal(result.stcPay.enabled, false);
  }
});

test("test mode refuses live or mismatched key pairs", () => {
  assert.equal(features({ ...testCredentials, HALA_PAYMENT_MODE: "test" }).configured, true);
  assert.equal(features({ ...liveCredentials, HALA_PAYMENT_MODE: "test" }).configured, false);
  assert.equal(features({ ...testCredentials, MOYASAR_SECRET_KEY: "sk_live_synthetic", HALA_PAYMENT_MODE: "test" }).configured, false);
});

test("live mode requires separate explicit activation and production context", () => {
  const env = { ...liveCredentials, HALA_PAYMENT_MODE: "live" };
  assert.equal(features(env).configured, false);
  assert.equal(features({ ...env, HALA_LIVE_PAYMENTS_ENABLED: "true", CONTEXT: "deploy-preview" }).configured, false);
  assert.equal(features({ ...env, HALA_LIVE_PAYMENTS_ENABLED: "true", CONTEXT: "production" }).configured, true);
});

import { normalizeDigits, normalizePhone } from "../netlify/functions/_shared/domain.mjs";
test("Arabic and Persian phone/OTP digits normalize consistently",()=>{
  assert.equal(normalizePhone("٠٥٠١١١٢٢٣٣"),"966501112233");
  assert.equal(normalizePhone("۰۵۰۱۱۱۲۲۳۳"),"966501112233");
  assert.equal(normalizeDigits("١٢٣٤٥٦"),"123456");
});
