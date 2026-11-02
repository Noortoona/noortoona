import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {secureJson} from './_shared/domain.mjs';
import {bookingSettings} from './_shared/bookings.mjs';
export default async(req:Request)=>{if(req.method!=='GET')return new Response('Method Not Allowed',{status:405});try{const {supportPhone,supervisorAddonAmount}=await bookingSettings(getDatabase());return secureJson({supportPhone,supervisorAddonAmount});}catch{return secureJson({error:'تعذر تحميل إعدادات التواصل'},503);}};
export const config:Config={path:'/api/public-settings'};
