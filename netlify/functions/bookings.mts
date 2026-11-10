import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {getAuth,sha256} from './_shared/auth.mjs';
import {isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {bookingContact,bookingError,customerBooking,quoteBooking,auditBooking} from './_shared/bookings.mjs';
import {analyticsEnvironment,normalizeAttribution,recordBookingCompletion} from './_shared/analytics.mjs';
import {bookingMessage,notifyBooking} from './_shared/booking-notifications.mjs';

export default async(req:Request)=>{
 if(!['GET','POST'].includes(req.method))return new Response('Method Not Allowed',{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 const db=getDatabase();let client:any;
 try{
  const auth=await getAuth(req),environment=analyticsEnvironment();
  if(req.method==='GET'){
   const id=new URL(req.url).searchParams.get('id');
   if(!id){if(!auth||auth.user.role!=='customer')return secureJson({error:'يجب تسجيل الدخول'},401);const rows=await db.sql`SELECT * FROM bookings WHERE user_id=${auth.user.id} AND environment=${environment} ORDER BY created_at DESC LIMIT 200`;return secureJson({bookings:rows.map(customerBooking)});}
   const row=(await db.sql`SELECT * FROM bookings WHERE id=${id} AND environment=${environment} LIMIT 1`)[0];
   const token=String(req.headers.get('x-booking-token')||'');
   if(!row||!(auth?.user.role==='customer'&&row.user_id===auth.user.id)&&(!/^[a-f0-9]{32,128}$/i.test(token)||row.access_token_hash!==await sha256(token)))return secureJson({error:'الحجز غير موجود أو غير مصرح'},404);
   if(auth?.user.role==='customer'&&!row.user_id){
    // Claiming a guest booking requires the original unguessable booking token.
    client=await db.pool.connect();await client.query('BEGIN');
    const locked=(await client.query('SELECT user_id FROM bookings WHERE id=$1 FOR UPDATE',[row.id])).rows[0];
    if(locked.user_id&&locked.user_id!==auth.user.id)throw bookingError('الحجز مرتبط بحساب آخر',409);
    await client.query('UPDATE bookings SET user_id=$1,updated_at=NOW() WHERE id=$2 AND user_id IS NULL',[auth.user.id,row.id]);
    await client.query("INSERT INTO event_members(event_id,user_id,member_role) VALUES($1,$2,'owner') ON CONFLICT DO NOTHING",[row.event_id,auth.user.id]);
    await auditBooking(client,auth.user.id,'booking.claimed',row.id);await client.query('COMMIT');client.release();client=null;
   }
   return secureJson({booking:customerBooking(row)});
  }
  const raw=await req.text();if(raw.length>32_000)throw bookingError('حجم الطلب أكبر من المسموح',413);
  const body=JSON.parse(raw),contact=bookingContact(body.contact),key=String(body.idempotencyKey||req.headers.get('idempotency-key')||''),token=String(body.accessToken||req.headers.get('x-booking-token')||'');
  if(auth&&auth.user.role!=='customer')throw bookingError('الحجز متاح لحساب العميل',403);
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(key)||!/^[a-f0-9]{32,128}$/i.test(token))throw bookingError('معرف أمان الطلب غير صالح');
  const eventId=String(body.eventId||''),services=Array.isArray(body.services)?[...new Set(body.services)].sort():body.services;
  const requestHash=await sha256(JSON.stringify({eventId,contact,guestCount:Number(body.guestCount),services,referralCode:String(body.referralCode||'').trim().toUpperCase(),packageCode:body.packageCode||'',entryDetails:body.entryDetails||{},supervisorPreference:body.supervisorPreference||'',marketingConsent:body.marketingConsent===true})),tokenHash=await sha256(token);
  client=await db.pool.connect();await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",['booking:'+key]);
  const prior=(await client.query('SELECT * FROM bookings WHERE idempotency_key=$1',[key])).rows[0];
  if(prior){if(prior.environment!==environment||prior.access_token_hash!==tokenHash||prior.request_hash!==requestHash)throw bookingError('معرف الطلب مستخدم لبيانات مختلفة',409);await client.query('COMMIT');client.release();client=null;return secureJson({booking:customerBooking(prior),accessToken:token,replayed:true});}
  const event=(await client.query('SELECT * FROM events WHERE id=$1 FOR UPDATE',[eventId])).rows[0];
  if(!event)throw bookingError('المناسبة غير موجودة',404);
  const member=auth&&(await client.query("SELECT 1 FROM event_members WHERE event_id=$1 AND user_id=$2 AND member_role='owner'",[eventId,auth.user.id])).rows[0];
  const suppliedOwner=String(body.ownerToken||req.headers.get('x-noortoona-owner-token')||'');
  if(!member&&(!suppliedOwner||await sha256(suppliedOwner)!==await sha256(event.owner_token)))throw bookingError('غير مصرح بحجز المناسبة',403);
  if((await client.query('SELECT id FROM bookings WHERE event_id=$1',[eventId])).rows[0])throw bookingError('لهذه المناسبة حجز سابق؛ افتح حجزي لمتابعته',409);
  if(services?.includes('supervisor')&&!['male','female','both'].includes(body.supervisorPreference))throw bookingError('اختر مشرفًا أو مشرفة');
  // Read catalog/settings within the same database transaction, avoiding another pool lease.
  const tx={sql:async(parts:any,...args:any[])=> (await client.query(parts.reduce((s:string,p:string,i:number)=>s+(i?'$'+i:'')+p,''),args)).rows};
  const priced=await quoteBooking(tx,{...body,services},auth?.user.id,event),q=priced.quote;
  if(body.expectedTotal!==undefined&&Number(body.expectedTotal)!==q.total)throw bookingError('تغير السعر؛ راجع السعر النهائي ثم أكد الطلب مجددًا',409);
  if(!event.event_date||!event.event_time||!event.location||!event.name1)throw bookingError('أكمل تاريخ ووقت المناسبة والموقع واسم صاحب المناسبة');
  if(q.entry){
   const details=body.entryDetails||{};
   if(!String(details.city||event.city||'').trim()||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(details.startTime||''))||!q.entry.durationHours||String(details.notes||'').length>2000)throw bookingError('أكمل المدينة ووقت بدء الاستقبال والمدة والملاحظات');
   q.entry.city=String(details.city||event.city).trim().slice(0,100);q.entry.location=event.location;q.entry.date=event.event_date;q.entry.startTime=details.startTime;q.entry.notes=String(details.notes||'').slice(0,2000);
   q.policySnapshot.entry={...q.policySnapshot.entry,...q.entry};
   priced.services[0]={...priced.services[0],...q.entry};
  }
  const {owner_token,...snapshot}=event;
  const attribution=normalizeAttribution(body.attribution);
  if(priced.partner){attribution.source=priced.partner.kind==='venue'?'partner_venue':'influencer';attribution.referral_code=priced.partner.code;}
  const id=crypto.randomUUID(),number='HALA-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
  const values=[id,number,eventId,auth?.user.id||null,key,tokenHash,requestHash,environment,contact.name,contact.phone,contact.email,Number(body.guestCount),q.guestLimit,q.packageCode,q.packageName,JSON.stringify(snapshot),JSON.stringify({...event.design_json,...(services.includes('supervisor')?{supervisorPreference:body.supervisorPreference}:{})}),JSON.stringify(priced.services),q.baseAmount,q.addonAmount,q.discountAmount,q.total,priced.partner?.code||null,priced.partner?.user_id||null,priced.commissionAmount,JSON.stringify(attribution),body.marketingConsent===true,String(body.sessionId||'').slice(0,80)||null,String(body.visitorId||'').slice(0,80)||null];
  const booking=(await client.query(`INSERT INTO bookings(id,booking_number,event_id,user_id,idempotency_key,access_token_hash,request_hash,environment,contact_name,contact_phone,contact_email,guest_count,guest_limit,package_code,package_name,event_snapshot,design_json,services_json,base_amount,addon_amount,discount_amount,total_amount,referral_code,partner_user_id,commission_amount,attribution,marketing_consent,session_id,visitor_id) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,values)).rows[0];
  await client.query('UPDATE bookings SET pricing_snapshot=$1::jsonb,tax_amount=$2,entry_status=$3 WHERE id=$4',[JSON.stringify(q.policySnapshot),q.taxAmount,q.entry?'pending_review':'not_requested',id]);
  booking.pricing_snapshot=q.policySnapshot;booking.tax_amount=q.taxAmount;booking.entry_status=q.entry?'pending_review':'not_requested';
  if(auth)await client.query("INSERT INTO event_members(event_id,user_id,member_role) VALUES($1,$2,'owner') ON CONFLICT DO NOTHING",[eventId,auth.user.id]);
  await client.query('UPDATE events SET referral_code=$1,package_name=$2 WHERE id=$3',[priced.partner?.code||null,q.packageName,eventId]);
  await client.query('INSERT INTO leads(id,name,phone,email,service,kind,source,environment,marketing_consent,user_id) VALUES($1,$2,$3,$4,$5,\'pre_booking\',$6::jsonb,$7,$8,$9) ON CONFLICT DO NOTHING',[crypto.randomUUID(),contact.name,contact.phone,contact.email,event.occasion,JSON.stringify(attribution),environment,body.marketingConsent===true,auth?.user.id||null]);
  const origin=new URL(req.url).origin,message=bookingMessage(booking,origin);
  for(const kind of ['internal','whatsapp'])await client.query("INSERT INTO booking_notifications(id,booking_id,kind,status,message) VALUES($1,$2,$3,$4,$5)",[crypto.randomUUID(),id,kind,kind==='internal'?'queued':'pending_setup',message]);
  await auditBooking(client,auth?.user.id,'booking.created',id,{number,total:q.total,paymentStatus:'pending_payment'});
  await recordBookingCompletion(client,booking);
  await client.query('COMMIT');client.release();client=null;
  let notification={status:'pending_setup'};try{notification=await notifyBooking(db,booking,origin);}catch{ /* Outbox/internal record survives provider/database follow-up failure. */ }
  return secureJson({booking:customerBooking(booking),accessToken:token,notification},201);
 }catch(e:any){if(client)await client.query('ROLLBACK').catch(()=>undefined);return secureJson({error:e.status?e.message:'تعذر تسجيل الحجز؛ لم يتم تأكيد الطلب'},e.status||500);}
 finally{if(client)client.release();}
};
export const config:Config={path:'/api/bookings',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:30}};
