import test from "node:test";
import assert from "node:assert/strict";
import { constantTimeEqual, assertPaymentMatches } from "../netlify/functions/_shared/moyasar.mjs";

test("webhook secret comparison is strict", () => {
  assert.equal(constantTimeEqual("abc123", "abc123"), true);
  assert.equal(constantTimeEqual("abc123", "abc124"), false);
  assert.equal(constantTimeEqual("short", "longer"), false);
  assert.equal(constantTimeEqual("", ""), false);
});

test("payment reconciliation rejects changed id, amount, or currency", () => {
  const order = { id: "order-1", amount: 9900, currency: "SAR" };
  assert.doesNotThrow(() => assertPaymentMatches(order, { id: "order-1", amount: 9900, currency: "sar" }));
  assert.throws(() => assertPaymentMatches(order, { id: "other", amount: 9900, currency: "SAR" }), /PAYMENT_MISMATCH/);
  assert.throws(() => assertPaymentMatches(order, { id: "order-1", amount: 100, currency: "SAR" }), /PAYMENT_MISMATCH/);
  assert.throws(() => assertPaymentMatches(order, { id: "order-1", amount: 9900, currency: "USD" }), /PAYMENT_MISMATCH/);
});
