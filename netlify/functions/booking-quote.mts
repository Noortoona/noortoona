import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {getAuth} from './_shared/auth.mjs';
import {isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {bookingSettings,quoteBooking} from './_shared/bookings.mjs';
export default async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 try{const db=getDatabase(),body:any=await req.json(),auth=await getAuth(req),{quote}=await quoteBooking(db,body,auth?.user.id);return secureJson({quote,supportPhone:(await bookingSettings(db)).supportPhone});}
 catch(e:any){return secureJson({error:e.status?e.message:'تعذر حساب السعر'},e.status||500);}
};
export const config:Config={path:'/api/bookings/quote'};
