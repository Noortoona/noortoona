import type { Config } from '@netlify/functions';
import { secureJson } from './_shared/domain.mjs';
import { readCatalog, publicCatalog } from './_shared/catalog.mjs';
import { quoteBooking } from './_shared/bookings.mjs';
import { getDatabase } from '@netlify/database';
export default async(req:Request)=>{
 if(req.method!=='GET')return new Response('Method Not Allowed',{status:405});
 try{const url=new URL(req.url),db=getDatabase(),catalog=await readCatalog(db),code=url.searchParams.get('package');
 if(!code)return secureJson({...publicCatalog(catalog),supervisorAddonAmount:catalog.entry.unitAmount,supervisorAddonSar:catalog.entry.unitAmount/100});
 const {quote}=await quoteBooking(db,{packageCode:code,guestCount:Number(url.searchParams.get('guests')||100),services:url.searchParams.get('supervisor')==='1'?['supervisor']:[],supervisorPreference:url.searchParams.get('preference')||'male',entryDetails:{entrances:Number(url.searchParams.get('entrances')||1)}});
 return secureJson({...quote,totalAmount:quote.total,amountSar:quote.total/100});
 }catch(e:any){return secureJson({error:e.status?e.message:'تعذر تحميل الأسعار الحالية'},e.status||503)}
};
export const config:Config={path:'/api/pricing/quote'};
