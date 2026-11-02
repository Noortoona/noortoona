import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {requireRole} from './_shared/auth.mjs';
import {isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {analyticsEnvironment} from './_shared/analytics.mjs';
import {notifyBooking} from './_shared/booking-notifications.mjs';
export default async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});
 const auth=await requireRole(req,['admin']);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 try{const body:any=await req.json(),db=getDatabase();const row=(await db.sql`SELECT * FROM bookings WHERE id=${String(body.bookingId||'')} AND environment=${analyticsEnvironment()} LIMIT 1`)[0];
 if(!row)return secureJson({error:'الحجز غير موجود'},404);
 // Unknown dispatch outcomes are deliberately not reset/retried automatically.
 return secureJson(await notifyBooking(db,row,new URL(req.url).origin));
 }catch{return secureJson({error:'تعذر معالجة الإشعار؛ يظل الحجز محفوظًا'},500);}
};
export const config:Config={path:'/api/admin/booking-notifications'};
