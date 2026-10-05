import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";
import { requireRole } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";
import { packageFor } from "./_shared/payments.mjs";
import { activePartner, normalizeReferralCode, referralAmounts } from "./_shared/partners.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const auth = await requireRole(req, ["customer"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const url = new URL(req.url);
  const code = normalizeReferralCode(url.searchParams.get("code"));
  const pkg = packageFor(url.searchParams.get("package"));
  if (!code || !pkg) return secureJson({ error: "تحقق من الكود والباقة" }, 400);
  const profile = await activePartner(getDatabase(), code, auth.user.id);
  if (!profile) return secureJson({ error: "كود الإحالة غير متاح" }, 404);
  const values = referralAmounts(pkg.amount, 0, profile);
  return secureJson({ code: profile.code, kind: profile.kind, baseAmount: pkg.amount,
    discountAmount: values.discountAmount, discountedPackageAmount: values.total, currency: pkg.currency });
};
export const config: Config = { path: "/api/referrals/quote" };
