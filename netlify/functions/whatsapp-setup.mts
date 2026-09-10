import type { Config } from "@netlify/functions";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async (req: Request) => {
  const mode = (Netlify.env.get("D360_MODE") || "sandbox").toLowerCase();

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // Browser-friendly one-click setup is intentionally allowed only in sandbox.
  // In production, require a dedicated secret token in an HTTP header.
  if (mode !== "sandbox") {
    const expected = Netlify.env.get("D360_SETUP_TOKEN");
    const supplied = req.headers.get("x-noortoona-setup-token");
    if (!expected || supplied !== expected) {
      return json({ ok: false, error: "Setup is locked in production" }, 403);
    }
  }

  const apiKey = Netlify.env.get("D360_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "D360_API_KEY is not configured" }, 503);
  }

  const apiBase = (Netlify.env.get("D360_API_BASE") || "https://waba-sandbox.360dialog.io/v1").replace(/\/$/, "");
  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/api/whatsapp/webhook`;

  try {
    const response = await fetch(`${apiBase}/configs/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "D360-API-KEY": apiKey,
      },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const text = await response.text();
    let providerResponse: unknown = text;
    try {
      providerResponse = text ? JSON.parse(text) : null;
    } catch {
      // Keep provider response as text when it is not JSON.
    }

    if (!response.ok) {
      return json({
        ok: false,
        message: "تعذر تسجيل Webhook لدى 360dialog",
        webhookUrl,
        providerStatus: response.status,
        providerResponse,
      }, 502);
    }

    return json({
      ok: true,
      message: "تم تسجيل Webhook لنورتونا بنجاح",
      mode,
      webhookUrl,
      providerStatus: response.status,
      providerResponse,
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
