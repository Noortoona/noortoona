import { providerConfig, providerError } from "./whatsapp.mjs";

const env = key => (typeof Netlify === "undefined" ? "" : String(Netlify.env.get(key) || "").trim());

const ZOHO_ACCOUNTS = new Set([
  "https://accounts.zoho.com","https://accounts.zoho.eu","https://accounts.zoho.sa",
  "https://accounts.zoho.in","https://accounts.zoho.com.au","https://accounts.zoho.jp",
  "https://accounts.zohocloud.ca"
]);
const ZOHO_MAIL = new Set([
  "https://mail.zoho.com","https://mail.zoho.eu","https://mail.zoho.sa",
  "https://mail.zoho.in","https://mail.zoho.com.au","https://mail.zoho.jp",
  "https://mail.zohocloud.ca"
]);

export function notificationChannelReady(channel) {
  if (channel === "email") {
    const accounts = env("HALA_ZOHO_ACCOUNTS_URL") || "https://accounts.zoho.com";
    const mail = env("HALA_ZOHO_MAIL_URL") || "https://mail.zoho.com";
    return ZOHO_ACCOUNTS.has(accounts) && ZOHO_MAIL.has(mail) &&
      /^\d+$/.test(env("HALA_ZOHO_ACCOUNT_ID")) &&
      ["HALA_ZOHO_CLIENT_ID","HALA_ZOHO_CLIENT_SECRET","HALA_ZOHO_REFRESH_TOKEN"]
        .every(key => Boolean(env(key)));
  }
  if (channel === "whatsapp") {
    if (!env("HALA_BOOKING_ALERT_TEMPLATE") || !env("HALA_BOOKING_ALERT_LANGUAGE") ||
        !env("D360_WEBHOOK_TOKEN") || !env("HALA_BOOKING_WA_SENDER_PHONE")) return false;
    try {
      const sender = env("HALA_BOOKING_WA_SENDER_PHONE").replace(/\D/g,"");
      if (sender === "966532763736" || !/^\d{10,15}$/.test(sender)) return false;
      return providerConfig(env).mode === "production";
    } catch { return false; }
  }
  return false;
}

export function bookingAlertText(b) {
  const amount = (Number(b.amount) / 100).toLocaleString("ar-SA", { maximumFractionDigits: 2 });
  return [
    "هلا | حجز مسبق جديد",
    "رقم الطلب: " + b.booking_code,
    "اسم العميل: " + (b.customer_name || "عميل هلا"),
    "الهاتف: " + (b.customer_phone || "غير متوفر"),
    "المناسبة: " + b.title,
    "التاريخ: " + (b.event_date ? String(b.event_date).slice(0,10) : "غير محدد"),
    "الباقة: " + b.package_name,
    "القيمة المتوقعة: " + amount + " ر.س (غير مدفوعة)",
    "الإحالة: " + (b.referral_code || "زيارة مباشرة/غير معروف"),
    "لوحة الإدارة: https://halainvites.com/admin"
  ].join("\n");
}

// A provider response is acceptance, not verified delivery to an inbox.
export async function sendBookingEmail(b, fetcher=fetch) {
  if (!notificationChannelReady("email")) throw new Error("EMAIL_NOT_CONFIGURED");
  const accounts = env("HALA_ZOHO_ACCOUNTS_URL") || "https://accounts.zoho.com";
  const mail = env("HALA_ZOHO_MAIL_URL") || "https://mail.zoho.com";
  const credentials = new URLSearchParams({
    refresh_token: env("HALA_ZOHO_REFRESH_TOKEN"),
    client_id: env("HALA_ZOHO_CLIENT_ID"),
    client_secret: env("HALA_ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  const tokenResponse = await fetcher(accounts + "/oauth/v2/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: credentials.toString(),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) throw new Error("ZOHO_AUTH_REJECTED");
  const response = await fetcher(mail + "/api/accounts/" + env("HALA_ZOHO_ACCOUNT_ID") + "/messages", {
    method: "POST",
    headers: { "authorization": "Zoho-oauthtoken " + tokenData.access_token,
      "accept":"application/json","content-type":"application/json" },
    body: JSON.stringify({
      fromAddress: "hello@halainvites.com",
      toAddress: "bookings@halainvites.com",
      subject: "هلا | حجز جديد " + b.booking_code,
      content: bookingAlertText(b), mailFormat: "plaintext", encoding: "UTF-8"
    }),
  });
  const body = await response.json();
  if (!response.ok || Number(body?.status?.code) !== 200 || !body?.data?.messageId) throw new Error("ZOHO_MESSAGE_REJECTED");
  return String(body.data.messageId).slice(0,180);
}

export async function sendBookingWhatsApp(b, fetcher=fetch) {
  if (!notificationChannelReady("whatsapp")) throw new Error("WHATSAPP_NOT_CONFIGURED");
  const { apiBase } = providerConfig(env);
  // This template must be approved with exactly three body text parameters.
  const response = await fetcher(apiBase + "/messages", {
    method: "POST",
    headers: { "D360-API-KEY": env("D360_API_KEY"),"content-type":"application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: "966532763736", type: "template",
      template: {
        name: env("HALA_BOOKING_ALERT_TEMPLATE"),
        language: { code: env("HALA_BOOKING_ALERT_LANGUAGE") },
        components: [{ type:"body", parameters:[
          {type:"text",text:String(b.booking_code).slice(0,40)},
          {type:"text",text:String(b.title).slice(0,120)},
          {type:"text",text:b.event_date?String(b.event_date).slice(0,10):"غير محدد"},
        ]}]
      }
    })
  });
  const data = await response.json();
  const messageId = data?.messages?.[0]?.id;
  if (!response.ok || !messageId) {
    const error = providerError(data);
    throw new Error("D360_REJECTED_" + error.code.replace(/[^\w-]/g,"").slice(0,40));
  }
  return String(messageId).slice(0,180);
}
