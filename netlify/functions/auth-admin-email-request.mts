import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { isSameOriginRequest,secureJson } from "./_shared/domain.mjs";
import { normalizeEmail,validEmail,emailHash,allowedEmail } from "./_shared/admin-email-otp.mjs";
export default async (req:Request)=>{
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
 try{
  const {email:raw}=await req.json();
  const email=normalizeEmail(raw);
  if(!validEmail(email))return secureJson({error:"البريد الإلكتروني غير صالح"},400);
  // Never mint privileges: email must be allowlisted AND belong to an existing privileged account.
  const db=getDatabase();
  const users=await db.sql`SELECT id FROM users WHERE LOWER(email)=${email} AND role IN ('admin','customer_service') AND status='active' LIMIT 1`;
  if(!allowedEmail(email)||!users[0])return secureJson({ok:true});
  const apiKey=Netlify.env.get("RESEND_API_KEY");
  const from=Netlify.env.get("HALA_AUTH_EMAIL_FROM");
  if(!apiKey||!from)return secureJson({error:"إرسال البريد غير مهيأ بعد"},503);
  const client=await db.pool.connect();
  let id="",code="";
  try{
   await client.query("BEGIN");
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["admin-email:"+email]);
   const recent=(await client.query("SELECT sent_at FROM admin_email_otp_codes WHERE email=$1 ORDER BY sent_at DESC LIMIT 1",[email])).rows[0];
   if(recent&&Date.now()-new Date(recent.sent_at).getTime()<60000){await client.query("ROLLBACK");return secureJson({error:"انتظر دقيقة قبل طلب رمز جديد"},429)}
   const count=(await client.query("SELECT COUNT(*)::int AS n FROM admin_email_otp_codes WHERE email=$1 AND sent_at>NOW()-INTERVAL '1 hour'",[email])).rows[0];
   if(Number(count?.n||0)>=5){await client.query("ROLLBACK");return secureJson({error:"تم تجاوز عدد الطلبات مؤقتًا"},429)}
   const random=new Uint32Array(1);crypto.getRandomValues(random);code=String(100000+random[0]%900000);
   id=crypto.randomUUID();
   const hash=await emailHash(email,code);
   await client.query("UPDATE admin_email_otp_codes SET consumed_at=NOW() WHERE email=$1 AND consumed_at IS NULL",[email]);
   await client.query("INSERT INTO admin_email_otp_codes(id,user_id,email,code_hash,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '5 minutes')",[id,users[0].id,email,hash]);
   await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}finally{client.release()}
  const resp=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:"رمز الدخول إلى إدارة هلا",text:"رمز الدخول إلى لوحة إدارة هلا: "+code+"\nصالح لمدة 5 دقائق. لا تشارك الرمز مع أحد."}),signal:AbortSignal.timeout(15000)});
  if(!resp.ok){await db.sql`UPDATE admin_email_otp_codes SET consumed_at=NOW() WHERE id=${id}`;return secureJson({error:"تعذر إرسال البريد، تحقق من إعدادات خدمة البريد"},503)}
  return secureJson({ok:true});
 }catch(error){console.error("admin-email-request failed",error);return secureJson({error:"تعذر طلب رمز الدخول"},500)}
};
export const config:Config={path:"/api/auth/admin-email/request"};
