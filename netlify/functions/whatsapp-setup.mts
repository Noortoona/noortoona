import type { Config } from "@netlify/functions";
import { providerConfig } from "./_shared/whatsapp.mjs";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default async (req: Request) => {

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // All provider configuration requires an administrator token, even in sandbox.
  {
    const expected = Netlify.env.get("D360_SETUP_TOKEN");
    const supplied = req.headers.get("x-noortoona-setup-token");
    if (!expected || supplied !== expected) {
      return json({ ok: false, error: "Setup authorization required" }, 403);
    }
  }

  const apiKey = Netlify.env.get("D360_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "D360_API_KEY is not configured" }, 503);
  }

  let settings: { mode: string; apiBase: string };
  try { settings = providerConfig((name: string) => Netlify.env.get(name)); }
  catch (error) { return json({ ok: false, code: (error as Error).message }, 503); }
  const { mode, apiBase } = settings;
  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/api/whatsapp/webhook`;
  // Readiness is not proof of provider-side webhook registration.
  if (req.method === 'GET') return json({ mode, apiBase, webhookUrl, apiKeyConfigured: true,
    inviteTemplate: Netlify.env.get('D360_INVITE_TEMPLATE') || null,
    reminderTemplate: Netlify.env.get('D360_REMINDER_TEMPLATE') || null,
    language: Netlify.env.get('D360_TEMPLATE_LANGUAGE') || null,
    webhookTokenConfigured: Boolean(Netlify.env.get('D360_WEBHOOK_TOKEN')),
    providerRegistrationVerified: false });
  const webhookToken = Netlify.env.get('D360_WEBHOOK_TOKEN');
  if (!webhookToken) return json({ error: 'D360_WEBHOOK_TOKEN required' }, 409);

  try {
    const response = await fetch(`${apiBase}/configs/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "D360-API-KEY": apiKey,
      },
      body: JSON.stringify({ url: webhookUrl, headers: { Authorization: `Bearer ${webhookToken}` } }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return json({
        ok: false,
        message: "تعذر تسجيل Webhook لدى 360dialog",
        webhookUrl,
        providerStatus: response.status,
      }, 502);
    }

    return json({
      ok: true,
      message: "تم تسجيل Webhook لهلا بنجاح",
      mode,
      webhookUrl,
      providerStatus: response.status,
    });
  } catch (error) {
    return json({
      ok: false,
      message: "تعذر الاتصال بخدمة 360dialog",
      webhookUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 502);
  }
};

export const config: Config = { path: "/api/whatsapp/setup" };
