import test from "node:test";
import assert from "node:assert/strict";
import { packageFor, publicPackages } from "../netlify/functions/_shared/payments.mjs";

test("Hala packages have server-owned prices and guest limits", () => {
  assert.deepEqual(publicPackages().map(p => [p.code, p.amount, p.guestLimit]), [
    ["start", 2900, 50],
    ["basic", 9900, 200],
    ["royal", 14900, 500],
  ]);
  assert.equal(packageFor("basic")?.currency, "SAR");
  assert.equal(packageFor("unknown"), null);
});
