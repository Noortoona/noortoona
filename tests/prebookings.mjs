import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {PGlite} from '@electric-sql/pglite';

// Every row and credential in this suite is synthetic, in a private embedded DB.
// No request reaches Netlify, production, Moyasar or WhatsApp.
registerHooks({resolve(specifier,context,next){
 if(specifier==='@netlify/database')return{url:'data:text/javascript,export function getDatabase(){return globalThis.__HALA_BOOKING_TEST_DB__}',shortCircuit:true};
 return next(specifier,context);
}});
const pg=new PGlite();
let tail=Promise.resolve();
async function lock(){const before=tail;let release;tail=new Promise(r=>release=r);await before;return release;}
const db={sql:async(parts,...values)=>{const release=await lock();try{return(await pg.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values)).rows;}finally{release();}},pool:{connect:async()=>{const release=await lock();return{query:(s,v)=>pg.query(s,v),release};}}};
globalThis.__HALA_BOOKING_TEST_DB__=db;
const env={CONTEXT:'deploy-preview',DEPLOY_ID:'booking-test-preview',D360_MODE:'sandbox',D360_API_KEY:'synthetic-key',D360_WEBHOOK_TOKEN:'synthetic-webhook-token'};
globalThis.Netlify={env:{get:key=>env[key]}};
let providerCalls=0,providerBehavior='accepted',lastProviderRequest;
globalThis.fetch=async(url,options)=>{lastProviderRequest={url,options};providerCalls++;if(providerBehavior==='timeout')throw Error('synthetic network timeout');return providerBehavior==='rejected'?Response.json({errors:[{code:'synthetic-rejection'}]},{status:400}):Response.json({messages:[{id:'synthetic-message-'+providerCalls}]});};
const h={};for(const name of ['bookings','booking-quote','admin-bookings','admin-booking-settings','public-settings','whatsapp-webhook'])h[name]=(await import('../netlify/functions/'+name+'.mts')).default;
const {createSession}=await import('../netlify/functions/_shared/auth.mjs');
const {notifyBooking}=await import('../netlify/functions/_shared/booking-notifications.mjs');
const {analyticsEnvironment}=await import('../netlify/functions/_shared/analytics.mjs');
function request(path,body,token='',method=body?'POST':'GET',extra={}){return new Request('https://staging.example'+path,{method,headers:{origin:'https://staging.example','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function json(handler,path,body,token='',method,extra){const r=await h[handler](request(path,body,token,method,extra));return{status:r.status,data:await r.json()};}
const key=()=>crypto.randomUUID();
const access=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
async function event(id=key(),owner='synthetic-owner-'+key(),overrides={}){
 const e={id,owner_token:owner,title:'حفل اختبار معزول',occasion:'زواج',name1:'عميل الاختبار',event_date:'2027-01-09',location:'قاعة اختبار',package_name:'هلا الأساسية',design_json:{headline:'تصميم محفوظ',image:'data:image/png;base64,VEVTVA=='},...overrides};
 await pg.query('INSERT INTO events(id,owner_token,title,occasion,name1,event_date,location,package_name,design_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[e.id,e.owner_token,e.title,e.occasion,e.name1,e.event_date,e.location,e.package_name,JSON.stringify(e.design_json)]);return e;
}
function payload(e,more={}){return{eventId:e.id,ownerToken:e.owner_token,idempotencyKey:key(),accessToken:access(),contact:{name:'عميل الاختبار',phone:'0531112233',email:'booking@example.test'},guestCount:80,services:[],referralCode:'',attribution:{utm_source:'TikTok',utm_campaign:'launch'},marketingConsent:false,...more};}
async function count(table,where=''){return Number((await pg.query('SELECT COUNT(*)::int count FROM '+table+' '+where)).rows[0].count);}

await test('prebooking persistence, authorization and transactional notification outbox',async t=>{
 t.after(()=>pg.close());
 for(const name of(await readdir(new URL('../netlify/database/migrations/',import.meta.url))).sort())await pg.exec(await readFile(new URL('../netlify/database/migrations/'+name+'/migration.sql',import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,name,phone,role) VALUES('admin','Admin','966501110001','admin'),('customer','Customer','966501110002','customer'),('other','Other','966501110003','customer'),('staff','Staff','966501110004','customer_service'),('partner','Influencer','966501110005','partner'),('venue','Venue','966501110006','partner')");
 const admin=(await createSession('admin')).token,customer=(await createSession('customer')).token,other=(await createSession('other')).token,staff=(await createSession('staff')).token;
 let saved,body;
 await t.test('fresh DB has no fabricated bookings, customers or financial activity',async()=>{
  assert.equal(await count('bookings'),0);assert.equal(await count('leads'),0);assert.equal(await count('payment_orders'),0);
  const view=await json('admin-bookings','/api/admin/bookings',undefined,staff);assert.equal(view.status,200);assert.equal(view.data.total,0);assert.deepEqual(view.data.bookings,[]);
 });
 await t.test('server authoritative quote ignores client money and applies only eligible partner discount',async()=>{
  await pg.exec("INSERT INTO partner_profiles(user_id,kind,code,commission_bps,discount_bps) VALUES('partner','influencer','TEST10',1000,1000),('venue','venue','VENUE10',1000,0)");
  const q=await json('booking-quote','/api/bookings/quote',{packageCode:'hala_basic',guestCount:80,services:[],referralCode:'TEST10',total:1});
  assert.equal(q.status,200);assert.equal(q.data.quote.baseAmount,44900);assert.equal(q.data.quote.discountAmount,4490);assert.equal(q.data.quote.total,40410);
  assert.equal((await json('booking-quote','/api/bookings/quote',{packageCode:'hala_basic',guestCount:101,services:[]})).status,400);
  const v=await json('booking-quote','/api/bookings/quote',{packageCode:'hala_basic',guestCount:80,services:[],referralCode:'VENUE10'});assert.equal(v.data.quote.discountAmount,0);assert.equal(v.data.quote.total,44900);
 });
 await t.test('guest booking stores snapshot, contact, trusted quote and attribution before reporting success',async()=>{
  const e=await event();body=payload(e,{referralCode:'TEST10',total_amount:1,payment_status:'paid'});
  const response=await json('bookings','/api/bookings',body);assert.equal(response.status,201,JSON.stringify(response.data));saved=response.data.booking;
  assert.match(saved.booking_number,/^HALA-[A-F0-9]{12}$/);assert.equal(saved.booking_status,'pre_booking_received');assert.equal(saved.payment_status,'pending_payment');assert.equal(saved.total_amount,40410);assert.equal(saved.contact_phone,'966531112233');
  assert.equal(saved.event_snapshot.location,e.location);assert.equal(saved.design_json.headline,'تصميم محفوظ');assert.equal(saved.event_snapshot.owner_token,undefined);assert.equal(saved.attribution.source,'influencer');assert.equal(saved.referral_code,'TEST10');assert.equal(saved.access_token_hash,undefined);
  const row=(await pg.query('SELECT * FROM bookings WHERE id=$1',[saved.id])).rows[0];assert.equal(row.environment,analyticsEnvironment());assert.equal(row.commission_amount,4041);assert.notEqual(row.access_token_hash,body.accessToken);
  assert.equal(await count('payment_orders'),0);assert.equal(await count('partner_commissions'),0);assert.equal(await count('customer_acquisitions'),0);
  assert.equal(await count('audit_log',"WHERE action='booking.created'"),1);assert.equal(await count('booking_notifications'),2);assert.equal(response.data.notification.status,'pending_setup');assert.equal(providerCalls,0);
 });
 await t.test('repeat request including concurrent clicks creates exactly one booking and two outbox rows',async()=>{
  const before=await count('bookings');const replies=await Promise.all([json('bookings','/api/bookings',body),json('bookings','/api/bookings',body)]);
  assert.ok(replies.every(r=>r.status===200&&r.data.replayed));assert.ok(replies.every(r=>r.data.booking.id===saved.id));assert.equal(await count('bookings'),before);assert.equal(await count('booking_notifications'),2);assert.equal(await count('leads'),1);
  assert.equal((await json('bookings','/api/bookings',{...body,guestCount:79})).status,409);assert.equal((await json('bookings','/api/bookings',{...body,accessToken:access()})).status,409);
  assert.equal((await json('bookings','/api/bookings',{...body,idempotencyKey:key()})).status,409);
 });
 await t.test('invalid contact, missing event fields, or event ownership never creates a booking',async()=>{
  const before=await count('bookings');const e=await event();
  assert.equal((await json('bookings','/api/bookings',payload(e,{contact:{name:'x',phone:'123'}}))).status,400);
  assert.equal((await json('bookings','/api/bookings',payload(e,{ownerToken:'wrong'}))).status,403);
  const missingDate=await event(undefined,undefined,{event_date:null});assert.equal((await json('bookings','/api/bookings',payload(missingDate))).status,400);
  const missingLocation=await event(undefined,undefined,{location:''});assert.equal((await json('bookings','/api/bookings',payload(missingLocation))).status,400);
  assert.equal((await json('bookings','/api/bookings',payload(e,{services:['supervisor']}))).status,400);assert.equal(await count('bookings'),before);
 });
 await t.test('booking tokens protect guest data and authenticated customers can claim only with original token',async()=>{
  assert.equal((await json('bookings','/api/bookings?id='+saved.id)).status,404);
  assert.equal((await json('bookings','/api/bookings?id='+saved.id,undefined,other)).status,404);
  const view=await json('bookings','/api/bookings?id='+saved.id,undefined,'','GET',{'x-booking-token':body.accessToken});assert.equal(view.status,200);assert.equal(view.data.booking.contact_name,body.contact.name);assert.equal(view.data.booking.notes,undefined);
  const claim=await json('bookings','/api/bookings?id='+saved.id,undefined,customer,'GET',{'x-booking-token':body.accessToken});assert.equal(claim.status,200);
  assert.equal((await pg.query('SELECT user_id FROM bookings WHERE id=$1',[saved.id])).rows[0].user_id,'customer');assert.equal(await count('event_members',"WHERE user_id='customer'"),1);
  const list=await json('bookings','/api/bookings',undefined,customer);assert.equal(list.data.bookings.length,1);
  assert.equal((await json('bookings','/api/bookings?id='+saved.id,undefined,other)).status,404);
 });
 await t.test('customer_service can follow up, assign and export but cannot change money, payment or settings',async()=>{
  assert.equal((await json('admin-bookings','/api/admin/bookings',undefined,customer)).status,403);
  const view=await json('admin-bookings','/api/admin/bookings?q='+saved.booking_number,undefined,staff);assert.equal(view.data.total,1);assert.equal(view.data.bookings[0].access_token_hash,undefined);assert.ok(view.data.staff.some(p=>p.id==='staff'));assert.ok(view.data.notifications.length>=2);
  const update=await json('admin-bookings','/api/admin/bookings',{id:saved.id,bookingStatus:'contacted',assignedUserId:'staff',notes:'تواصل فعلي مسجل',followupStatus:'follow_up',nextFollowUpAt:'2027-01-01T12:00:00Z'},staff,'PATCH');assert.equal(update.status,200,JSON.stringify(update.data));assert.equal(update.data.booking.followup_status,'follow_up');assert.ok(update.data.booking.last_follow_up_at);
  for(const forbidden of [{paymentStatus:'paid'},{total_amount:1},{bookingStatus:'confirmed'}])assert.equal((await json('admin-bookings','/api/admin/bookings',{id:saved.id,...forbidden},staff,'PATCH')).status,400);
  assert.equal((await json('admin-booking-settings','/api/admin/booking-settings',undefined,staff)).status,403);
  const csv=await h['admin-bookings'](request('/api/admin/bookings?format=csv',undefined,staff));assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(await csv.text(),new RegExp(saved.booking_number));
  assert.equal(await count('audit_log',"WHERE action='booking.followup_updated'"),1);
 });
 await t.test('official WhatsApp settings are persistent, validated, and only writable by admin',async()=>{
  assert.equal((await json('public-settings','/api/public-settings')).data.supportPhone,'966532763736');
  assert.equal((await json('admin-booking-settings','/api/admin/booking-settings',{supportPhone:'123'},admin,'PATCH')).status,400);
  assert.equal((await json('admin-booking-settings','/api/admin/booking-settings',{supportPhone:'0532763736',notificationPhone:'0532763736'},admin,'PATCH')).status,200);
  assert.equal((await json('public-settings','/api/public-settings')).data.supportPhone,'966532763736');
 });
 function enableNotifications(){Object.assign(env,{HALA_BOOKING_NOTIFICATIONS_ENABLED:'true',D360_BOOKING_TEMPLATE_APPROVED:'true',HALA_BOOKING_NOTIFICATION_RECIPIENT_CONFIRMED:'true',D360_BOOKING_TEMPLATE:'synthetic_approved_booking',D360_SENDER_PHONE:'966501110099',HALA_BOOKING_NOTIFICATIONS_PREVIEW:'true'});}
 await t.test('provider API acceptance remains queued and retry does not dispatch twice',async()=>{
  enableNotifications();providerBehavior='accepted';const e=await event();const b=payload(e);const response=await json('bookings','/api/bookings',b);assert.equal(response.status,201);assert.equal(response.data.notification.status,'queued');assert.equal(providerCalls,1);
  const row=(await pg.query("SELECT * FROM booking_notifications WHERE booking_id=$1 AND kind='whatsapp'",[response.data.booking.id])).rows[0];assert.equal(row.status,'queued');assert.equal(row.message_id,'synthetic-message-1');
  assert.equal((await notifyBooking(db,(await pg.query('SELECT * FROM bookings WHERE id=$1',[response.data.booking.id])).rows[0],'https://staging.example')).status,'already_attempted');assert.equal(providerCalls,1);
  const callback=status=>request('/api/whatsapp/webhook',{statuses:[{id:row.message_id,status,timestamp:String(Math.floor(Date.now()/1000))}]},'','POST',{authorization:'Bearer synthetic-webhook-token'});
  assert.equal((await h['whatsapp-webhook'](callback('sent'))).status,200);assert.equal((await h['whatsapp-webhook'](callback('delivered'))).status,200);assert.equal((await h['whatsapp-webhook'](callback('sent'))).status,200);
  assert.equal((await pg.query('SELECT status FROM booking_notifications WHERE id=$1',[row.id])).rows[0].status,'delivered');
 });
 await t.test('WhatsApp failure or ambiguous timeout cannot lose a committed booking or resend',async()=>{
  providerBehavior='timeout';const b=payload(await event());const before=await count('bookings');const response=await json('bookings','/api/bookings',b);assert.equal(response.status,201);assert.equal(await count('bookings'),before+1);assert.equal(response.data.notification.status,'failed');
  const notification=(await pg.query("SELECT * FROM booking_notifications WHERE booking_id=$1 AND kind='whatsapp'",[response.data.booking.id])).rows[0];assert.equal(notification.error_code,'DISPATCH_UNCERTAIN');assert.equal(notification.status,'failed');
  const calls=providerCalls;assert.equal((await json('bookings','/api/bookings',b)).status,200);assert.equal(providerCalls,calls);
  assert.equal(await count('booking_notifications',"WHERE kind='internal' AND booking_id='"+response.data.booking.id+"'"),1);
 });
 await t.test('same sender/recipient or unapproved template stays pending setup without sending',async()=>{
  const calls=providerCalls;env.D360_SENDER_PHONE='966532763736';const response=await json('bookings','/api/bookings',payload(await event()));assert.equal(response.status,201);assert.equal(response.data.notification.status,'pending_setup');assert.equal(providerCalls,calls);
 });
 await t.test('Meta transport requires separate approved configuration and authentic signed delivery events',async()=>{
  env.HALA_BOOKING_WA_PROVIDER='meta';env.META_WA_GRAPH_VERSION='v24.0';env.META_WA_PHONE_NUMBER_ID='123456789012345';env.META_WA_SENDER_PHONE='966510654663';
  env.META_WA_ACCESS_TOKEN='synthetic-meta-token';env.META_WA_APP_SECRET='synthetic-meta-secret';env.META_WA_VERIFY_TOKEN='synthetic-verify-token';
  env.META_WA_BOOKING_TEMPLATE='hala_new_booking_admin_ar';env.META_WA_BOOKING_TEMPLATE_APPROVED='true';providerBehavior='accepted';
  const before=providerCalls;const response=await json('bookings','/api/bookings',payload(await event()));
  assert.equal(response.status,201);assert.equal(response.data.notification.status,'queued');assert.equal(providerCalls,before+1);
  assert.equal(lastProviderRequest.url,'https://graph.facebook.com/v24.0/123456789012345/messages');
  assert.equal(lastProviderRequest.options.headers.authorization,'Bearer synthetic-meta-token');
  assert.equal(lastProviderRequest.options.headers['D360-API-KEY'],undefined);
  const outbound=JSON.parse(lastProviderRequest.options.body);
  assert.equal(outbound.to,'966532763736');assert.equal(outbound.template.name,'hala_new_booking_admin_ar');
  assert.equal(outbound.template.components[0].parameters.length,7);
  const row=(await pg.query("SELECT * FROM booking_notifications WHERE booking_id=$1 AND kind='whatsapp'",[response.data.booking.id])).rows[0];
  const base='https://staging.example/api/whatsapp/webhook';
  const verify=await h['whatsapp-webhook'](new Request(base+'?hub.mode=subscribe&hub.verify_token=synthetic-verify-token&hub.challenge=1234'));
  assert.equal(verify.status,200);assert.equal(await verify.text(),'1234');
  assert.equal((await h['whatsapp-webhook'](new Request(base+'?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234'))).status,403);
  const body=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:env.META_WA_PHONE_NUMBER_ID},statuses:[{id:row.message_id,status:'delivered'}]}}]}]});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.META_WA_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature='sha256='+Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');
  const callback=sig=>h['whatsapp-webhook'](new Request(base,{method:'POST',headers:{'x-hub-signature-256':sig},body}));
  assert.equal((await callback('sha256='+'0'.repeat(64))).status,401);
  assert.equal((await pg.query('SELECT status FROM booking_notifications WHERE id=$1',[row.id])).rows[0].status,'queued');
  assert.equal((await callback(signature)).status,200);
  assert.equal((await pg.query('SELECT status FROM booking_notifications WHERE id=$1',[row.id])).rows[0].status,'delivered');
  const calls=providerCalls;assert.equal((await notifyBooking(db,(await pg.query('SELECT * FROM bookings WHERE id=$1',[response.data.booking.id])).rows[0],'https://staging.example')).status,'already_attempted');assert.equal(providerCalls,calls);
  env.META_WA_BOOKING_TEMPLATE_APPROVED='false';
  const pending=await json('bookings','/api/bookings',payload(await event()));assert.equal(pending.data.notification.status,'pending_setup');assert.equal(providerCalls,calls);
  delete env.HALA_BOOKING_WA_PROVIDER;
 });
 await t.test('preview records never appear in production bookings or customer listing',async()=>{
  env.CONTEXT='production';const view=await json('admin-bookings','/api/admin/bookings',undefined,admin);assert.equal(view.data.total,0);const list=await json('bookings','/api/bookings',undefined,customer);assert.deepEqual(list.data.bookings,[]);env.CONTEXT='deploy-preview';
 });
});
