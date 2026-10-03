import type { Config } from "@netlify/functions";
import { ensureAuthSchema, hashPassword, publicUser, requireRole } from "./_shared/auth.mjs";
import { normalizePhone, secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  const db = await ensureAuthSchema();

  if (req.method === "GET") {
    const rows = await db.sql`
      SELECT id, name, email, phone, role, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 500
    `;
    return secureJson({ users: rows.map(publicUser) });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const name = String(body.name || "").trim().slice(0, 120);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
      const password = String(body.password || "");
      const role = body.role === "supervisor" ? "supervisor" : "customer";
      if (name.length < 2 || !email.includes("@") || password.length < 8) {
        return secureJson({ error: "تحقق من الاسم والبريد وكلمة المرور" }, 400);
      }
      const passwordData = await hashPassword(password);
      const rows = await db.sql`
        INSERT INTO users (id, name, email, phone, password_salt, password_hash, role)
        VALUES (${crypto.randomUUID()}, ${name}, ${email}, ${normalizePhone(body.phone || "") || null}, ${passwordData.salt}, ${passwordData.hash}, ${role})
        RETURNING id, name, email, phone, role, status
      `;
      return secureJson({ user: publicUser(rows[0]) }, 201);
    } catch (error) {
      console.error(error);
      return secureJson({ error: "تعذر إنشاء المستخدم، وقد يكون البريد مستخدمًا" }, 400);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = { path: "/api/admin/users" };
