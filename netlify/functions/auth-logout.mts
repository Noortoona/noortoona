import type { Config } from "@netlify/functions";
import { revokeSession } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  await revokeSession(req);
  return secureJson({ ok: true });
};

export const config: Config = { path: "/api/auth/logout" };
