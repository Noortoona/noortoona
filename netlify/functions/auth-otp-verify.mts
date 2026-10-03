import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { createSession, publicUser, recordAudit } from "./_shared/auth.mjs";
import { isSameOriginRequest, normalizePhone, secureJson } from "./_shared/domain.mjs";
import { hashOtp, normalizeLoginPhone } from "./_shared/otp.mjs";

export default async(req:Request)=>{
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
  try{
    const body:any=await req.json(),phone=normalizeLoginPhone(body.phone),code=String(body.code||"").replace(/\D/g,"");
    if(!phone||!/^\d{6}$/.test(code))return secureJson({error:"تحقق من رقم الجوال والرمز"},400);
    const db=getDatabase();
    const rows=await db.sql`SELECT * FROM otp_codes WHERE phone=${phone} AND consumed_at IS NULL AND expires_at>NOW() ORDER BY sent_at DESC LIMIT 1`;
    const otp:any=rows[0]; if(!otp)return secureJson({error:"انتهت صلاحية الرمز، اطلب رمزًا جديدًا"},400);
    if(Number(otp.attempts||0)>=5)return secureJson({error:"تم تجاوز عدد المحاولات لهذا الرمز"},429);
    const hash=await hashOtp(phone,code);
    if(hash!==otp.code_hash){await db.sql`UPDATE otp_codes SET attempts=attempts+1 WHERE id=${otp.id}`;return secureJson({error:"رمز التحقق غير صحيح"},401);}
    await db.sql`UPDATE otp_codes SET consumed_at=NOW() WHERE id=${otp.id}`;
    const adminPhone=normalizePhone(Netlify.env.get("HALA_ADMIN_PHONE")||"");
    let users=await db.sql`SELECT id,name,email,phone,role,status FROM users WHERE phone=${phone} LIMIT 1`;
    let user:any=users[0];
    if(!user){
      const role=adminPhone&&phone===adminPhone?"admin":"customer";
      const name=String(body.name||"").trim().slice(0,120)||(role==="admin"?"مدير هلا":"عميل هلا");
      const created=await db.sql`INSERT INTO users(id,name,phone,role) VALUES(${crypto.randomUUID()},${name},${phone},${role}) RETURNING id,name,email,phone,role,status`;
      user=created[0];
    }else if(adminPhone&&phone===adminPhone&&user.role!=="admin"){
      const upgraded=await db.sql`UPDATE users SET role='admin',updated_at=NOW() WHERE id=${user.id} RETURNING id,name,email,phone,role,status`;user=upgraded[0];
    }
    if(user.status!=="active")return secureJson({error:"الحساب موقوف"},403);
    const session=await createSession(user.id);await recordAudit(user.id,"auth.otp_verified","user",user.id,{channel:"whatsapp"});
    return secureJson({user:publicUser(user),...session});
  }catch(error){console.error(error);return secureJson({error:"تعذر التحقق من الرمز"},500)}
};
export const config:Config={path:"/api/auth/otp/verify"};
