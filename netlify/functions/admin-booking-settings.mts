import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {requireRole} from './_shared/auth.mjs';
import {normalizePhone,isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {bookingSettings,auditBooking,bookingError,validPhone} from './_shared/bookings.mjs';
export default async(req:Request)=>{
 const auth=await requireRole(req,['admin']);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 if(!['GET','PATCH'].includes(req.method))return new Response('Method Not Allowed',{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 const db=getDatabase();let client:any;
 try{
  if(req.method==='GET')return secureJson(await bookingSettings(db));
  const body:any=await req.json();if(Object.keys(body).some(k=>!['supportPhone','notificationPhone'].includes(k)))throw bookingError('إعداد غير مسموح');
  client=await db.pool.connect();await client.query('BEGIN');
  for(const [field,key]of [['supportPhone','support_phone'],['notificationPhone','booking_notification_phone']])if(body[field]!==undefined){if(!validPhone(body[field]))throw bookingError('رقم الجوال غير صالح');await client.query('INSERT INTO platform_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()',[key,normalizePhone(body[field])]);}
  await auditBooking(client,auth.user.id,'settings.booking_contact_updated','booking_settings',{fields:Object.keys(body)});await client.query('COMMIT');client.release();client=null;
  return secureJson(await bookingSettings(db));
 }catch(e:any){if(client)await client.query('ROLLBACK').catch(()=>undefined);return secureJson({error:e.status?e.message:'تعذر حفظ إعدادات التواصل'},e.status||500);}finally{if(client)client.release();}
};
export const config:Config={path:'/api/admin/booking-settings'};
