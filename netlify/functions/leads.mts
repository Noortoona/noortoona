import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {getAuth} from './_shared/auth.mjs';
import {isSameOriginRequest,normalizePhone,secureJson} from './_shared/domain.mjs';
import {analyticsEnvironment,normalizeAttribution,recordServerInterest} from './_shared/analytics.mjs';
export default async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 if(Number(req.headers.get('content-length')||0)>6000)return secureJson({error:'حجم الطلب أكبر من المسموح'},413);
 let client:any;try{
 const b:any=await req.json();if(JSON.stringify(b).length>6000)return secureJson({error:'حجم الطلب أكبر من المسموح'},413);
 const name=String(b.name||'').trim().slice(0,120),phone=b.phone?normalizePhone(b.phone):'',email=String(b.email||'').trim().toLowerCase(),kind=b.kind==='contact'?'contact':b.kind==='launch'?'launch':'',key=String(b.idempotencyKey||''),service=String(b.service||'').trim().slice(0,160);
 if(!kind||!/^[a-zA-Z0-9_-]{16,80}$/.test(key)||(!phone&&!email)||(phone&&!/^9665\d{8}$/.test(phone))||(phone&&/(\d)\1{6}/.test(phone))||(email&&(!/^[^\s@<>]{1,80}@[^\s@<>]{1,120}\.[A-Za-z]{2,24}$/.test(email)||/@(?:example\.com|test\.com|example\.org|example\.net)$|\.invalid$/.test(email)))||(name&&(!/[\p{L}]/u.test(name)||/[<>]/.test(name))))return secureJson({error:'أدخل وسيلة تواصل صحيحة وبيانات حقيقية'},400);
 let scope:any=null;
 if(b.quoteRequest){
  const r=b.quoteRequest;
  if(!['business','enterprise','custom'].includes(r.type)||typeof r.organization!=='string'||r.organization.trim().length<2||r.organization.length>180||typeof r.eventType!=='string'||!r.eventType.trim()||r.eventType.length>160||!Number.isInteger(Number(r.guestCount))||Number(r.guestCount)<1||Number(r.guestCount)>1000000||!Number.isInteger(Number(r.eventCount))||Number(r.eventCount)<1||Number(r.eventCount)>10000||typeof r.services!=='string'||r.services.length>2000)return secureJson({error:'أكمل بيانات المؤسسة أو المناسبة والخدمات المطلوبة'},400);
  scope={requestKey:key,type:r.type,organization:r.organization.trim(),eventType:r.eventType.trim(),guestCount:Number(r.guestCount),eventCount:Number(r.eventCount),services:r.services.trim(),receivedAt:new Date().toISOString(),status:'new'};
 }
 const auth=await getAuth(req),environment=analyticsEnvironment();
 client=await getDatabase().pool.connect();await client.query('BEGIN');
 for(const contact of [phone?`phone:${phone}`:'',email?`email:${email}`:''].filter(Boolean).sort())await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`lead:${environment}:${contact}`]);
 const prior=(await client.query("SELECT id,requests_json FROM leads WHERE environment=$1 AND (idempotency_key=$2 OR ($3<>'' AND phone=$3) OR ($4<>'' AND lower(email)=$4)) LIMIT 1",[environment,key,phone,email])).rows[0];
 if(prior){
 if(scope){const existing=prior.requests_json.find((r:any)=>r.requestKey===key);if(existing&&['requestKey','type','organization','eventType','guestCount','eventCount','services'].some(k=>existing[k]!==scope[k])){await client.query('ROLLBACK');return secureJson({error:'معرف الطلب مستخدم لبيانات أخرى'},409);}if(!existing)await client.query('UPDATE leads SET requests_json=requests_json || $1::jsonb WHERE id=$2',[JSON.stringify([scope]),prior.id]);}
 await client.query("UPDATE leads SET marketing_consent=marketing_consent OR $1,kind=CASE WHEN kind='pre_booking' THEN $2 ELSE kind END,updated_at=NOW() WHERE id=$3",[b.marketingConsent===true,kind,prior.id]);await recordServerInterest(client,{event:kind==='contact'?'contact_requested':'launch_subscribed',entityId:prior.id,sessionId:b.sessionId,attribution:b.attribution});await client.query('COMMIT');return secureJson({id:prior.id,received:true,contactVerification:'unverified_submission'},200);}
 const id=crypto.randomUUID();
 await client.query("INSERT INTO leads(id,name,phone,email,service,kind,source,marketing_consent,user_id,idempotency_key,environment) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)",[id,name||null,phone||null,email||null,service,kind,JSON.stringify(normalizeAttribution(b.attribution)),b.marketingConsent===true,auth?.user.id||null,key,environment]);
 if(scope)await client.query('UPDATE leads SET requests_json=$1::jsonb WHERE id=$2',[JSON.stringify([scope]),id]);
 await recordServerInterest(client,{event:kind==='contact'?'contact_requested':'launch_subscribed',entityId:id,sessionId:b.sessionId,visitorId:b.visitorId,attribution:b.attribution});
 await client.query("INSERT INTO audit_log(id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'lead.received','lead',$3,$4::jsonb)",[crypto.randomUUID(),auth?.user.id||null,id,JSON.stringify({kind,marketingConsent:b.marketingConsent===true,environment})]);
 await client.query('COMMIT');return secureJson({id,received:true,contactVerification:'unverified_submission'},201);
 }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('Lead submission failed');return secureJson({error:'تعذر حفظ طلب التواصل؛ حاول مجددًا'},500)}finally{if(client)client.release()}
};
export const config:Config={path:'/api/leads',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:10}};
