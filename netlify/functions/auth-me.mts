import type { Config } from "@netlify/functions";
import { requireRole } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const auth = await requireRole(req);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  return secureJson({ user: auth.user });
};

export const config: Config = { path: "/api/auth/me" };
