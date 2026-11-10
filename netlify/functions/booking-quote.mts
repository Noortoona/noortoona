import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {getAuth} from './_shared/auth.mjs';
import {isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {bookingSettings,quoteBooking} from './_shared/bookings.mjs';
export default async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 try{const raw=await req.text();if(raw.length>16000)return secureJson({error:'حجم الطلب أكبر من المسموح'},413);const db=getDatabase(),body:any=JSON.parse(raw),auth=await getAuth(req),{quote}=await quoteBooking(db,body,auth?.user.id);return secureJson({quote,supportPhone:(await bookingSettings(db)).supportPhone});}
 catch(e:any){return secureJson({error:e.status?e.message:'تعذر حساب السعر'},e.status||500);}
};
export const config:Config={path:'/api/bookings/quote',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:60}};
