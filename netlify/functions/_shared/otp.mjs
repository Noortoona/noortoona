import { getDatabase } from "@netlify/database";
import { normalizePhone } from "./domain.mjs";
import { providerConfig, providerError } from "./whatsapp.mjs";
import { sha256 } from "./auth.mjs";

export function normalizeLoginPhone(raw){
  const phone=normalizePhone(raw);
  if(!/^[1-9]\d{7,14}$/.test(phone))return "";
  return phone;
}
export async function hashOtp(phone,code){
  const secret=String(Netlify.env.get("HALA_OTP_SECRET")||"");
  if(secret.length<24)throw new Error("OTP_SECRET_REQUIRED");
  return sha256(`${phone}:${code}:${secret}`);
}
export function createOtp(){
  const a=new Uint32Array(1);crypto.getRandomValues(a);
  return String(100000+(a[0]%900000));
}
export async function issueOtp(phone){
  const db=getDatabase();
  const recent=await db.sql`SELECT sent_at FROM otp_codes WHERE phone=${phone} ORDER BY sent_at DESC LIMIT 1`;
  if(recent[0]&&Date.now()-new Date(recent[0].sent_at).getTime()<60_000){
    return {ok:false,status:429,error:"انتظر دقيقة قبل طلب رمز جديد"};
  }
  const hour=await db.sql`SELECT COUNT(*)::int AS count FROM otp_codes WHERE phone=${phone} AND sent_at>NOW()-INTERVAL '1 hour'`;
  if(Number(hour[0]?.count||0)>=5)return {ok:false,status:429,error:"تم تجاوز عدد المحاولات مؤقتًا"};
  const code=createOtp(),hash=await hashOtp(phone,code),id=crypto.randomUUID();
  const expiresAt=new Date(Date.now()+5*60_000).toISOString();
  await db.sql`INSERT INTO otp_codes(id,phone,code_hash,expires_at) VALUES(${id},${phone},${hash},${expiresAt}::timestamptz)`;
  return {ok:true,id,code,expiresAt};
}
export async function sendOtp(phone,code){
  const apiKey=Netlify.env.get("D360_API_KEY");
  let cfg;try{cfg=providerConfig(name=>Netlify.env.get(name));}catch(e){throw new Error((e).message||"D360_NOT_CONFIGURED")}
  const lang=String(Netlify.env.get("D360_OTP_LANGUAGE")||"ar");
  const template=String(Netlify.env.get("D360_OTP_TEMPLATE")||"");
  const payload=cfg.mode==="production"
    ? (template?{
        messaging_product:"whatsapp",recipient_type:"individual",to:phone,type:"template",
        template:{name:template,language:{code:lang},components:[
          {type:"body",parameters:[{type:"text",text:code}]},
          {type:"button",sub_type:"url",index:0,parameters:[{type:"text",text:code}]}
        ]}
      }:null)
    : {messaging_product:"whatsapp",recipient_type:"individual",to:phone,type:"text",text:{body:`رمز التحقق في هلا: ${code}\nصالح لمدة 5 دقائق. لا تشارك الرمز مع أحد.`}};
  if(!payload)throw new Error("OTP_TEMPLATE_REQUIRED");
  const res=await fetch(`${cfg.apiBase}/messages`,{method:"POST",headers:{"content-type":"application/json","D360-API-KEY":String(apiKey||"")},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const p=providerError(data);const err=new Error(p.message);err.code=p.code;throw err}
  if(!data?.messages?.[0]?.id)throw new Error("OTP_MESSAGE_ID_MISSING");
  return {messageId:String(data.messages[0].id)};
}
