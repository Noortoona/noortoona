import type { Config } from "@netlify/functions";
import { ensureAuthSchema, hashPassword, publicUser } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  return secureJson({ error: "تم تعطيل الإعداد المؤقت" }, 410);
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const expected = String(Netlify.env.get("HALA_ADMIN_SETUP_KEY") || "");
  const supplied = String(req.headers.get("x-hala-setup-key") || "");
  if (!expected || supplied !== expected) return secureJson({ error: "غير مصرح" }, 403);

  try {
    const body = await req.json();
    const name = String(body.name || "Hala Admin").trim().slice(0, 120);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const password = String(body.password || "");
    if (!email.includes("@") || password.length < 12) {
      return secureJson({ error: "البريد مطلوب وكلمة مرور الأدمن يجب أن تكون 12 حرفًا على الأقل" }, 400);
    }
    const db = await ensureAuthSchema();
    const existingAdmins = await db.sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
    if (existingAdmins[0]) return secureJson({ error: "تم إنشاء حساب الأدمن الأساسي مسبقًا" }, 409);
    const p = await hashPassword(password);
    const rows = await db.sql`
      INSERT INTO users (id, name, email, password_salt, password_hash, role)
      VALUES (${crypto.randomUUID()}, ${name}, ${email}, ${p.salt}, ${p.hash}, 'admin')
      RETURNING id, name, email, phone, role, status
    `;
    return secureJson({ user: publicUser(rows[0]) }, 201);
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر إنشاء حساب الأدمن" }, 500);
  }
};

export const config: Config = { path: "/api/auth/bootstrap-admin" };
