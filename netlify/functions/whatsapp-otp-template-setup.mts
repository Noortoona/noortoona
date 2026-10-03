import type { Config } from "@netlify/functions";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"},
  });
}

export default async (req: Request) => {
  if (req.method !== "GET") return json({ok:false,error:"Method not allowed"},405);

  const expected = Netlify.env.get("D360_TEMPLATE_SETUP_TOKEN") || "";
  const supplied = new URL(req.url).searchParams.get("token") || "";
  if (!expected || supplied !== expected) return json({ok:false,error:"Setup authorization required"},403);

  const apiKey = Netlify.env.get("D360_API_KEY");
  const templateName = Netlify.env.get("D360_OTP_TEMPLATE") || "hala_login_otp";
  const language = Netlify.env.get("D360_OTP_LANGUAGE") || "ar";
  if (!apiKey) return json({ok:false,error:"D360_API_KEY is not configured"},503);

  const base = "https://waba-v2.360dialog.io";
  try {
    const current = await fetch(`${base}/v1/configs/templates`, {
      headers: {"D360-API-KEY": apiKey},
      signal: AbortSignal.timeout(15000),
    });
    const existingPayload: any = await current.json().catch(()=>({}));
    if (!current.ok) return json({ok:false,stage:"list",providerStatus:current.status},502);

    const list = Array.isArray(existingPayload)
      ? existingPayload
      : (existingPayload.waba_templates || existingPayload.templates || existingPayload.data || []);
    const existing = Array.isArray(list) ? list.find((t:any)=>String(t?.name||"")===templateName) : null;
    if (existing) {
      return json({ok:true,created:false,name:templateName,status:existing.status||null,id:existing.id||existing.external_id||null});
    }

    const response = await fetch(`${base}/v1/configs/templates`, {
      method: "POST",
      headers: {"content-type":"application/json","D360-API-KEY": apiKey},
      body: JSON.stringify({
        name: templateName,
        language,
        category: "authentication",
        message_send_ttl_seconds: 300,
        components: [
          {type:"body", add_security_recommendation:true},
          {type:"footer", code_expiration_minutes:5},
          {type:"buttons", buttons:[{type:"otp", otp_type:"copy_code"}]}
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const payload: any = await response.json().catch(()=>({}));
    if (!response.ok) {
      return json({
        ok:false,
        stage:"create",
        providerStatus:response.status,
        providerCode:String(payload?.error?.code||payload?.code||"").slice(0,80),
        providerMessage:String(payload?.error?.message||payload?.message||"Template creation failed").slice(0,300),
      },502);
    }
    return json({ok:true,created:true,name:templateName,status:payload?.status||"PENDING",id:payload?.id||null});
  } catch (error) {
    return json({ok:false,error:error instanceof Error ? error.message : "Unknown error"},502);
  }
};

export const config: Config = {path:"/api/internal/setup-otp-template"};
