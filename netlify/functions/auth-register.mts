import type { Config } from "@netlify/functions";
import { createSession, ensureAuthSchema, hashPassword, publicUser } from "./_shared/auth.mjs";
import { isSameOriginRequest, normalizePhone, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!isSameOriginRequest(req)) return secureJson({ error: "طلب غير مسموح" }, 403);
  try {
    const body = await req.json();
    const name = String(body.name || "").trim().slice(0, 120);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const password = String(body.password || "");
    const phone = normalizePhone(body.phone || "");
    if (name.length < 2) return secureJson({ error: "الاسم مطلوب" }, 400);
    if (!email.includes("@")) return secureJson({ error: "البريد الإلكتروني غير صالح" }, 400);
    if (password.length < 8) return secureJson({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);

    const db = await ensureAuthSchema();
    const existing = await db.sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing[0]) return secureJson({ error: "يوجد حساب بهذا البريد" }, 409);

    const id = crypto.randomUUID();
    const passwordData = await hashPassword(password);
    const rows = await db.sql`
      INSERT INTO users (id, name, email, phone, password_salt, password_hash, role)
      VALUES (${id}, ${name}, ${email}, ${phone || null}, ${passwordData.salt}, ${passwordData.hash}, 'customer')
      RETURNING id, name, email, phone, role, status
    `;
    const session = await createSession(id);
    return secureJson({ user: publicUser(rows[0]), ...session }, 201);
  } catch (error) {
    console.error(error);
    return secureJson({ error: "تعذر إنشاء الحساب" }, 500);
  }
};

export const config: Config = { path: "/api/auth/register" };
