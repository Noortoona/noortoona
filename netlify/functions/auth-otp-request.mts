import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
import { issueOtp, normalizeLoginPhone, sendOtp } from "./_shared/otp.mjs";

export default async(req:Request)=>{
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
  try{
    const body:any=await req.json();
    const phone=normalizeLoginPhone(body.phone);
    if(!phone)return secureJson({error:"رقم الجوال غير صالح"},400);
    const issued:any=await issueOtp(phone);
    if(!issued.ok)return secureJson({error:issued.error},issued.status);
    try{const sent=await sendOtp(phone,issued.code);await getDatabase().sql`UPDATE otp_codes SET message_id=${sent.messageId},delivery_status='queued' WHERE id=${issued.id}`;return secureJson({ok:true,phone,expiresAt:issued.expiresAt,messageId:sent.messageId,deliveryStatus:'queued'});}
    catch(error:any){const db=getDatabase();await db.sql`DELETE FROM otp_codes WHERE id=${issued.id}`;const code=String(error?.message||"");return secureJson({error:code==="OTP_TEMPLATE_REQUIRED"?"قالب رسالة التحقق غير مفعّل بعد":"تعذر إرسال رمز التحقق",code},503);}
  }catch(error){console.error(error);return secureJson({error:"تعذر إرسال رمز التحقق"},500)}
};
export const config:Config={path:"/api/auth/otp/request"};
