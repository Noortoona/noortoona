import type { Config } from "@netlify/functions";
import { createSession, ensureAuthSchema, publicUser, verifyPassword } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const password = String(body.password || "");
    if (!email || !password) return secureJson({ error: "أدخل البريد وكلمة المرور" }, 400);

    const db = await ensureAuthSchema();
    const rows = await db.sql`
      SELECT id, name, email, phone, role, status, password_salt, password_hash
      FROM users WHERE email = ${email} LIMIT 1
    `;
    const user = rows[0];
    const valid = user ? await verifyPassword(password, user.password_salt, user.password_hash) : false;
    if (!user || !valid) return secureJson({ error: "بيانات الدخول غير صحيحة" }, 401);
    if (user.status !== "active") return secureJson({ error: "الحساب موقوف" }, 403);

    const session = await createSession(user.id);
    return secureJson({ user: publicUser(user), ...session });
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر تسجيل الدخول" }, 500);
  }
};

export const config: Config = { path: "/api/auth/login" };
