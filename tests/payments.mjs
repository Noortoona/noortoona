import test from "node:test";
import assert from "node:assert/strict";
import { packageFor, packageForPaidOrder, publicPackages } from "../netlify/functions/_shared/payments.mjs";

test("Hala packages have server-owned prices and guest limits", () => {
  assert.deepEqual(publicPackages().map(p => [p.code, p.amount, p.guestLimit]), [
    ["hala_basic", 44900, 100],
    ["hala_plus", 109900, 250],
    ["hala_premium", 179900, 500],
  ]);
  assert.equal(packageFor("hala_plus")?.currency, "SAR");
  assert.equal(packageFor("basic"), null);
  assert.equal(packageForPaidOrder("start")?.guestLimit, 50);
  assert.equal(packageForPaidOrder("basic")?.guestLimit, 200);
  assert.equal(packageForPaidOrder("royal")?.guestLimit, 500);
  assert.equal(packageForPaidOrder("hala_plus")?.guestLimit, 250);
  assert.equal(packageFor("unknown"), null);
});

test("unverified reference prices stay hidden from customer-facing packages", () => {
  for (const pkg of publicPackages()) {
    assert.equal(pkg.referenceAmountSar, undefined);
    assert.equal(pkg.promoLicenseId, undefined);
  }
});
