import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { createSession,publicUser,recordAudit } from "./_shared/auth.mjs";
import { isSameOriginRequest,normalizeDigits,secureJson } from "./_shared/domain.mjs";
import { normalizeEmail,validEmail,emailHash,allowedEmail } from "./_shared/admin-email-otp.mjs";
export default async (req:Request)=>{
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
 try{
  const body:any=await req.json();const email=normalizeEmail(body.email);
  const code=normalizeDigits(body.code).replace(/\D/g,"");
  if(!validEmail(email)||!/^\d{6}$/.test(code))return secureJson({error:"تحقق من البريد والرمز"},400);
  if(!allowedEmail(email))return secureJson({error:"الرمز غير صحيح أو منتهي"},401);
  const db=getDatabase();
  const rows=await db.sql`SELECT * FROM admin_email_otp_codes WHERE email=${email} AND consumed_at IS NULL AND expires_at>NOW() ORDER BY sent_at DESC LIMIT 1`;
  const otp:any=rows[0];
  if(!otp)return secureJson({error:"الرمز غير صحيح أو منتهي"},401);
  const reserved=await db.sql`UPDATE admin_email_otp_codes SET attempts=attempts+1 WHERE id=${otp.id} AND attempts<5 AND consumed_at IS NULL AND expires_at>NOW() RETURNING id`;
  if(!reserved[0])return secureJson({error:"انتهت المحاولات المتاحة"},429);
  if(await emailHash(email,code)!==otp.code_hash)return secureJson({error:"الرمز غير صحيح أو منتهي"},401);
  const consumed=await db.sql`UPDATE admin_email_otp_codes SET consumed_at=NOW() WHERE id=${otp.id} AND consumed_at IS NULL AND expires_at>NOW() RETURNING id`;
  if(!consumed[0])return secureJson({error:"الرمز مستخدم أو منتهي"},409);
  const users=await db.sql`SELECT id,name,email,phone,role,status FROM users WHERE id=${otp.user_id} AND LOWER(email)=${email} AND role IN ('admin','customer_service') AND status='active' LIMIT 1`;
  const user:any=users[0];
  if(!user)return secureJson({error:"الحساب لا يملك صلاحية الإدارة"},403);
  await db.sql`DELETE FROM sessions WHERE user_id=${user.id}`;
  const session=await createSession(user.id);
  await recordAudit(user.id,"auth.admin_email_verified","user",user.id,{channel:"email"});
  return secureJson({user:publicUser(user),...session});
 }catch(error){console.error("admin-email-verify failed",error);return secureJson({error:"تعذر التحقق من البريد"},500)}
};
export const config:Config={path:"/api/auth/admin-email/verify"};
