import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {defaultPackages,featuresFor,entryQuote,taxQuote} from '../shared/pricing-policy.mjs';
registerHooks({resolve(s,c,next){if(s==='@netlify/database')return{url:'data:text/javascript,export function getDatabase(){return globalThis.__PRICING_DB__}',shortCircuit:true};return next(s,c);}});
const pg=new PGlite();let tail=Promise.resolve();
async function lock(){const before=tail;let release;tail=new Promise(r=>release=r);await before;return release;}
const db={sql:async(p,...v)=>{const release=await lock();try{return(await pg.query(p.reduce((s,x,i)=>s+(i?'$'+i:'')+x,''),v)).rows;}finally{release();}},pool:{connect:async()=>{const release=await lock();return{query:(s,v)=>pg.query(s,v),release};}}};
globalThis.__PRICING_DB__=db;
const env={CONTEXT:'deploy-preview',DEPLOY_ID:'pricing-v2-fixture',HALA_PAYMENT_MODE:'test',MOYASAR_PUBLISHABLE_KEY:'pk_test_fixture',MOYASAR_SECRET_KEY:'sk_test_fixture'};globalThis.Netlify={env:{get:k=>env[k]}};
let externalCalls=0;globalThis.fetch=async()=>{externalCalls++;throw Error('External calls forbidden in isolated pricing tests');};
const h={};for(const name of ['catalog','admin-catalog','booking-quote','bookings','create-event','admin-bookings','leads','admin-leads','payment-order','check-in','whatsapp-send','supervisor-addon','admin-supervisors','admin-event-members','admin-overview'])h[name]=(await import('../netlify/functions/'+name+'.mts')).default;
const {createSession}=await import('../netlify/functions/_shared/auth.mjs');
const {reconcileMoyasarOrder}=await import('../netlify/functions/_shared/moyasar.mjs');
const req=(path,body,token='',method=body?'POST':'GET',extra={})=>new Request('https://preview.example'+path,{method,headers:{origin:'https://preview.example','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function call(name,body,token='',method,path,extra){const r=await h[name](req(path||'/api/'+name,body,token,method,extra));return{status:r.status,data:await r.json()};}
const key=()=>crypto.randomUUID(),secret=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');

await test('V2 shared policy, persistence, operations, payment boundaries and safe custom requests',async t=>{
 t.after(()=>pg.close());for(const name of(await readdir(new URL('../netlify/database/migrations/',import.meta.url))).sort())await pg.exec(await readFile(new URL('../netlify/database/migrations/'+name+'/migration.sql',import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,name,phone,role) VALUES('admin','Admin','966501112233','admin'),('customer','Customer','966501112234','customer'),('other','Other','966501112235','customer'),('staff','Staff','966501112236','customer_service'),('one','One','966501112237','supervisor'),('two','Two','966501112238','supervisor'),('partner','Partner','966501112239','partner')");
 const tokens={};for(const id of ['admin','customer','other','staff','one','two'])tokens[id]=(await createSession(id)).token;
 const quote=body=>call('booking-quote',body);
 const patch=body=>call('admin-catalog',body,tokens.admin,'PATCH');
 async function ev(){const r=await call('create-event',{name1:'عميل اختبار',name2:'سارة',occasion:'زواج',date:'2027-04-20',time:'19:30',city:'الرياض',location:'قاعة الاختبار',package:'hala_basic',template:'حديقة اللؤلؤ',design:{occasionKey:'wedding'}},tokens.customer);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
 const payload=e=>({eventId:e.event.id,ownerToken:e.ownerToken,idempotencyKey:key(),accessToken:secret(),packageCode:'hala_basic',guestCount:100,services:[],contact:{name:'عميل اختبار',phone:'0531234567'},referralCode:''});
 let saved,body;
 await t.test('all nine prices are exact and client-supplied amounts cannot change them',async()=>{
  const expected={hala_basic:[39900,79900,139900],hala_plus:[84900,174900,299900],hala_premium:[129900,269900,449900]};
  for(const [code,prices]of Object.entries(expected))for(const [i,count]of [100,250,500].entries()){
   const r=await quote({packageCode:code,guestCount:count,services:[],amount:1,total:1,discountAmount:99999});assert.equal(r.status,200);assert.equal(r.data.quote.baseAmount,prices[i]);assert.equal(r.data.quote.total,prices[i]);assert.equal(r.data.quote.guestLimit,count);assert.equal(r.data.quote.taxAmount,null);assert.equal(r.data.quote.provisional,true);
  }
  for(const n of [0,80,101,249,501,1000])assert.equal((await quote({packageCode:'hala_basic',guestCount:n})).status,422);
  assert.equal(featuresFor(defaultPackages()[0]).some(f=>f.id==='qr'),true);assert.equal(featuresFor(defaultPackages()[2]).some(f=>f.id==='revisions'),true);
 });
 await t.test('entry pricing counts people and entrances, never promises availability or invents special rates',async()=>{
  for(const [count,preference,entrances,amount,people]of [[100,'male',1,59900,1],[250,'female',1,59900,1],[100,'both',1,119800,2],[100,'male',2,119800,2],[500,'female',1,119800,2],[500,'both',2,119800,2]]){
   const r=await quote({packageCode:'hala_plus',guestCount:count,services:['supervisor'],supervisorPreference:preference,entryDetails:{entrances,durationHours:3}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.quote.addonAmount,amount);assert.equal(r.data.quote.entry.organizers,people);assert.equal(r.data.quote.entry.availability,'pending_review');
  }
  assert.equal((await quote({packageCode:'hala_plus',guestCount:250,services:['supervisor'],supervisorPreference:'both',entryDetails:{entrances:3,durationHours:3}})).status,422);
  assert.equal(entryQuote({unitAmount:59900,standardHours:3},100,{preference:'male',durationHours:4}).customQuoteRequired,true);
 });
 await t.test('actual admin controls tax; unknown status blocks payment and preserves the saved policy',async()=>{
  const e=await ev();const b=payload(e),r=await call('bookings',b,tokens.customer);assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.booking.pricing_snapshot.tax.status,'unconfigured');
  assert.equal((await call('payment-order',{eventId:e.event.id},tokens.customer)).data.code,'BOOKING_REVIEW_REQUIRED');
  assert.equal((await patch({tax:{status:'registered',rateBps:1500,pricesIncludeTax:false,registrationNumber:'bad'}})).status,400);
  assert.equal((await patch({tax:{status:'registered',rateBps:1500,pricesIncludeTax:false,registrationNumber:'310000000000003'}})).status,200);
  assert.equal((await call('payment-order',{eventId:e.event.id},tokens.customer)).status,409,'later tax setting never silently reprices an existing booking');
  assert.equal(taxQuote(39900,{status:'registered',rateBps:1500,pricesIncludeTax:true}).total,39900);
 });
 await t.test('validated referrals, tax and immutable snapshot survive repeats and later price changes',async()=>{
  await pg.exec("INSERT INTO partner_profiles(user_id,kind,code,commission_bps,discount_bps) VALUES('partner','influencer','TEST10',1000,1000)");
  const e=await ev();body={...payload(e),referralCode:'TEST10',total_amount:1,payment_status:'paid'};
  const q=(await quote(body)).data.quote;assert.equal(q.discountAmount,3990);assert.equal(q.taxAmount,5387);assert.equal(q.total,41297);
  body.expectedTotal=q.total;
  const r=await call('bookings',body,tokens.customer);assert.equal(r.status,201,JSON.stringify(r.data));saved=r.data.booking;assert.equal(saved.total_amount,q.total);assert.equal(saved.payment_status,'pending_payment');assert.equal(saved.pricing_snapshot.version,'hala-packages-2026-11-v2');
  const replay=await Promise.all([call('bookings',body,tokens.customer),call('bookings',body,tokens.customer)]);assert.ok(replay.every(r=>r.status===200&&r.data.replayed&&r.data.booking.id===saved.id));
  assert.equal((await call('bookings',{...body,guestCount:250},tokens.customer)).status,409);
  assert.equal((await patch({packages:[{code:'hala_basic',priceTiers:{100:49900,250:89900,500:149900}}]})).status,200);
  const row=(await pg.query('SELECT * FROM bookings WHERE id=$1',[saved.id])).rows[0];assert.equal(row.base_amount,39900);assert.equal(row.total_amount,41297);assert.equal(row.pricing_snapshot.priceTiers[100],39900);
  const payment=await call('payment-order',{eventId:e.event.id,amount:1,packageCode:'hala_premium'},tokens.customer);assert.equal(payment.status,201,JSON.stringify(payment.data));assert.equal(payment.data.order.amount,41297);
  const order=(await pg.query('SELECT * FROM payment_orders WHERE id=$1',[payment.data.order.id])).rows[0];
  await assert.rejects(()=>reconcileMoyasarOrder(db,order,{id:order.id,status:'paid',amount:1,currency:'SAR'}),/MISMATCH/);
  await reconcileMoyasarOrder(db,order,{id:order.id,status:'paid',amount:order.amount,currency:'SAR',source:{type:'creditcard'}});
  assert.equal((await pg.query('SELECT payment_status,booking_status FROM bookings WHERE id=$1',[saved.id])).rows[0].booking_status,'confirmed');
 });
 await t.test('authorization, administrator visibility, package filters and completion distinguish money from requests',async()=>{
  assert.equal((await call('admin-bookings',undefined)).status,401);assert.equal((await call('admin-bookings',undefined,tokens.customer)).status,403);
  const list=await call('admin-bookings',undefined,tokens.admin,'GET','/api/admin/bookings?packageCode=hala_basic&guestCount=100');assert.equal(list.status,200,JSON.stringify(list.data));assert.ok(list.data.bookings.some(b=>b.id===saved.id));assert.equal(list.data.summary.paid_value,41297);
  assert.equal((await call('admin-bookings',{id:saved.id,paymentStatus:'paid'},tokens.admin,'PATCH')).status,400);
  assert.equal((await call('bookings',undefined,tokens.other,'GET','/api/bookings?id='+saved.id)).status,404);
  const view=await call('bookings',undefined,'','GET','/api/bookings?id='+saved.id,{'x-booking-token':body.accessToken});assert.equal(view.status,200);assert.equal(view.data.booking.access_token_hash,undefined);
  assert.equal((await call('admin-bookings',{id:saved.id,bookingStatus:'completed'},tokens.admin,'PATCH')).status,200);
 });
 await t.test('entry requests persist complete details and are reviewed and assigned as a full team',async()=>{
  await patch({tax:{status:'not_registered'}});
  const e=await ev(),b={...payload(e),guestCount:500,services:['supervisor'],supervisorPreference:'both',entryDetails:{entrances:2,durationHours:3,startTime:'18:30',city:'الرياض',notes:'مدخلان منفصلان'}};
  const r=await call('bookings',b,tokens.customer);assert.equal(r.status,201,JSON.stringify(r.data));const booking=r.data.booking;assert.equal(booking.entry_status,'pending_review');assert.equal(booking.addon_amount,119800);assert.equal(booking.services_json[0].organizers,2);
  const entryView=await call('supervisor-addon',undefined,tokens.customer,'GET','/api/events/supervisor?eventId='+e.event.id);assert.equal(entryView.data.source,'booking');assert.equal(entryView.data.request.organizers,2);assert.equal(entryView.data.request.amount,119800);
  assert.equal((await call('supervisor-addon',{eventId:e.event.id,requested:false},tokens.customer)).status,409,'legacy mutation must not desynchronize the saved booking');

  assert.equal((await call('payment-order',{eventId:e.event.id},tokens.customer)).status,409);
  assert.equal((await call('admin-bookings',{id:booking.id,entryStatus:'available'},tokens.staff,'PATCH')).status,403);
  assert.equal((await call('admin-bookings',{id:booking.id,entryStatus:'available'},tokens.admin,'PATCH')).status,200);
  const [p,p2]=await Promise.all([call('payment-order',{eventId:e.event.id},tokens.customer),call('payment-order',{eventId:e.event.id},tokens.customer)]);assert.equal(p.status,201,JSON.stringify(p.data));assert.equal(p2.status,201,JSON.stringify(p2.data));assert.equal(p.data.order.id,p2.data.order.id,'concurrent payment setup reuses the same order');const o=(await pg.query('SELECT * FROM payment_orders WHERE id=$1',[p.data.order.id])).rows[0];await reconcileMoyasarOrder(db,o,{id:o.id,status:'paid',amount:o.amount,currency:'SAR'});
  assert.equal((await call('admin-bookings',{id:booking.id,entryStatus:'assigned',organizerIds:['one']},tokens.admin,'PATCH')).status,400);
  assert.equal((await call('admin-bookings',{id:booking.id,entryStatus:'assigned',organizerIds:['one','two']},tokens.admin,'PATCH')).status,200);
  assert.equal((await pg.query("SELECT count(*)::int n FROM event_members WHERE event_id=$1 AND member_role='supervisor'",[e.event.id])).rows[0].n,2);
  await pg.query("INSERT INTO supervisor_requests(id,event_id,user_id,amount,status) VALUES('legacy-v2',$1,'customer',59900,'requested')",[e.event.id]);
  assert.equal((await call('admin-supervisors',{requestId:'legacy-v2',supervisorId:'one'},tokens.admin)).status,409,'old assignment API cannot bypass the two-person booking team');
  assert.equal((await call('admin-event-members',{eventId:e.event.id,userId:'one',action:'remove'},tokens.admin)).status,409,'old member screen cannot leave the booking assignment inconsistent');
  const overview=await call('admin-overview',undefined,tokens.admin);assert.equal(overview.status,200);assert.equal(overview.data.stats.supervisorRequests.assigned,1);assert.equal(overview.data.stats.supervisorRequests.total,1,'legacy mirror is not counted twice');

  await pg.query("INSERT INTO guests(id,event_id,name,code,rsvp_status) VALUES('guest-checkin',$1,'Guest','V2CHECK','accepted')",[e.event.id]);
  const scans=await Promise.all([call('check-in',{eventId:e.event.id,code:'V2CHECK'},tokens.one),call('check-in',{eventId:e.event.id,code:'V2CHECK'},tokens.two)]);assert.ok(scans.every(r=>r.status===200));assert.equal(scans.filter(r=>r.data.alreadyCheckedIn).length,1);
  assert.equal((await call('check-in',{eventId:e.event.id,code:'V2CHECK'},tokens.other)).status,403);
  assert.equal((await call('admin-bookings',{id:booking.id,entryStatus:'available',organizerIds:[]},tokens.admin,'PATCH')).status,200);
  assert.equal((await call('check-in',{eventId:e.event.id,code:'V2CHECK'},tokens.one)).status,403,'revoked organizer loses access immediately');
 });
 await t.test('historical standalone entry amounts and paid assignments remain usable',async()=>{
  const e=await ev();
  await pg.query("INSERT INTO supervisor_requests(id,event_id,user_id,amount,status) VALUES('historic-request',$1,'customer',29900,'requested')",[e.event.id]);
  const view=await call('supervisor-addon',undefined,tokens.customer,'GET','/api/events/supervisor?eventId='+e.event.id);assert.equal(view.status,200);assert.equal(view.data.request.amount,29900,'historical amount is not replaced by the current 599 rate');
  await pg.query("INSERT INTO payment_orders(id,event_id,user_id,package_code,amount,guest_limit,status,supervisor_addon_amount) VALUES('historic-paid',$1,'customer','hala_basic',39800,100,'paid',29900)",[e.event.id]);
  const assigned=await call('admin-supervisors',{requestId:'historic-request',supervisorId:'one'},tokens.admin);assert.equal(assigned.status,200);assert.equal(assigned.data.request.amount,29900);
 });
 await t.test('late payment verification cannot revive cancellation or downgrade paid orders',async()=>{
  const e=await ev(),b=payload(e);const saved=await call('bookings',b,tokens.customer);assert.equal(saved.status,201);
  const p=await call('payment-order',{eventId:e.event.id},tokens.customer);assert.equal(p.status,201);
  const order=(await pg.query('SELECT * FROM payment_orders WHERE id=$1',[p.data.order.id])).rows[0];
  assert.equal((await call('admin-bookings',{id:saved.data.booking.id,bookingStatus:'cancelled'},tokens.admin,'PATCH')).status,200);
  await reconcileMoyasarOrder(db,order,{id:order.id,status:'paid',amount:order.amount,currency:'SAR'});
  const state=(await pg.query('SELECT payment_status,booking_status FROM bookings WHERE id=$1',[saved.data.booking.id])).rows[0];assert.equal(state.payment_status,'paid');assert.equal(state.booking_status,'cancelled');
  const result=await reconcileMoyasarOrder(db,order,{id:order.id,status:'failed',amount:order.amount,currency:'SAR'});assert.equal(result.paid,true);assert.equal((await pg.query('SELECT status FROM payment_orders WHERE id=$1',[order.id])).rows[0].status,'paid');
 });
 await t.test('business/custom requests save in the existing CRM with attribution and idempotency',async()=>{
  const b={kind:'contact',idempotencyKey:key(),name:'مسؤول شركة',phone:'0531234599',attribution:{utm_source:'partner',referral_code:'TEST10'},quoteRequest:{type:'business',organization:'شركة الاختبار',eventType:'مؤتمر',guestCount:1000,eventCount:3,services:'هوية وQR وتقارير'}};
  assert.equal((await call('leads',b)).status,201);assert.equal((await call('leads',b)).status,200);
  const list=await call('admin-leads',undefined,tokens.staff);const lead=list.data.leads.find(l=>l.phone==='966531234599');assert.equal(lead.requests_json.length,1);assert.equal(lead.requests_json[0].guestCount,1000);
  assert.equal((await call('leads',{...b,quoteRequest:{...b.quoteRequest,guestCount:2000}})).status,409);
  assert.equal((await call('leads',{...b,idempotencyKey:key(),quoteRequest:{...b.quoteRequest,type:'enterprise'}})).status,200);
  assert.equal((await pg.query('SELECT requests_json FROM leads WHERE id=$1',[lead.id])).rows[0].requests_json.length,2);
 });
 await t.test('template tiers and automatic messaging are enforced by the server',async()=>{
  const denied=await call('create-event',{name1:'عميل',package:'hala_basic',template:'أقواس ذهبية',design:{occasionKey:'wedding'}},tokens.customer);assert.equal(denied.status,400);
  const e=await ev();const b=payload(e);const saved=await call('bookings',b,tokens.customer);assert.equal(saved.status,201);
  await pg.query("INSERT INTO guests(id,event_id,name,phone,code) VALUES('automation-guest',$1,'Guest','966501112211','AUTO1')",[e.event.id]);
  Object.assign(env,{D360_MODE:'sandbox',D360_API_KEY:'synthetic',D360_WEBHOOK_TOKEN:'synthetic'});
  const blocked=await call('whatsapp-send',{eventId:e.event.id,guestId:'automation-guest'},tokens.customer);assert.equal(blocked.status,403);assert.equal(blocked.data.code,'PACKAGE_AUTOMATION_NOT_INCLUDED');assert.equal(externalCalls,0);
 });
 await t.test('price changes can be scheduled, audited and cannot be overwritten by stale revisions',async()=>{
  const before=(await call('admin-catalog',undefined,tokens.admin)).data;
  const date=new Date(Date.now()+3600000).toISOString();const change={expectedRevision:before.revision,effectiveAt:date,packages:[{code:'hala_plus',priceTiers:{100:99900,250:199900,500:349900}}]};
  assert.equal((await patch(change)).status,200);assert.equal((await quote({packageCode:'hala_plus',guestCount:100})).data.quote.baseAmount,84900);
  assert.equal((await patch(change)).status,409);
  const row=(await pg.query("SELECT value FROM platform_settings WHERE key='catalog_config_v1'")).rows[0];const stored=JSON.parse(row.value);stored.scheduled.effectiveAt='2020-01-01T00:00:00Z';await pg.query("UPDATE platform_settings SET value=$1 WHERE key='catalog_config_v1'",[JSON.stringify(stored)]);
  assert.equal((await quote({packageCode:'hala_plus',guestCount:100})).data.quote.baseAmount,99900);
  assert.equal(externalCalls,0);
 });
});
