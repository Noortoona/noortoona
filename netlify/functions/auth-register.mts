import type { Config } from "@netlify/functions";
import { secureJson } from "./_shared/domain.mjs";

// Phone identity and privileged access must be established by WhatsApp OTP.
// Legacy email registration could claim a phone without verifying ownership.
export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  return secureJson({ error: "استخدم تسجيل الدخول برقم الجوال ورمز التحقق", code: "PHONE_OTP_REQUIRED" }, 410);
};

export const config: Config = { path: "/api/auth/register" };
