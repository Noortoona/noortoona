import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {normalizeAttribution,safeMetadata} from '../netlify/functions/_shared/analytics.mjs';
registerHooks({resolve(specifier,context,next){if(specifier==='@netlify/database')return{url:'data:text/javascript,export function getDatabase(){return globalThis.__HALA_ANALYTICS_DB__}',shortCircuit:true};return next(specifier,context)}});
const pg=new PGlite();let tail=Promise.resolve();
async function acquire(){let release;const prior=tail;tail=new Promise(resolve=>release=resolve);await prior;return release}
const db={sql:async(parts,...values)=>{const release=await acquire();try{return(await pg.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values)).rows}finally{release()}},pool:{connect:async()=>{const release=await acquire();return{query:(s,v)=>pg.query(s,v),release}}}};
globalThis.__HALA_ANALYTICS_DB__=db;
const env={CONTEXT:'deploy-preview',DEPLOY_ID:'analytics-review'};globalThis.Netlify={env:{get:key=>env[key]}};
const handlers={};for(const name of ['analytics-track','leads','admin-leads','admin-insights'])handlers[name]=(await import('../netlify/functions/'+name+'.mts')).default;
const {createSession}=await import('../netlify/functions/_shared/auth.mjs');
const request=(path,body,token='',method=body?'POST':'GET',ua='Mozilla/5.0 iPhone')=>new Request('https://staging.example'+path,{method,headers:{origin:'https://staging.example','content-type':'application/json','user-agent':ua,...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
const environment='preview:analytics-review';
const track=(event,sessionId='session_tracking_0001',extra={})=>({consent:true,eventId:crypto.randomUUID(),sessionId,visitorId:'visitor_tracking_0001',event,path:'/booking',attribution:{utm_source:'instagram',referrer:'https://instagram.com/path?email=private@example.com'},...extra});

test('attribution preserves only marketing evidence and strips personal metadata',()=>{
 const a=normalizeAttribution({utm_source:'TikTok',utm_campaign:'wedding',referrer:'https://tiktok.com/path?email=person@secret.sa',phone:'966501234567'});
 assert.equal(a.source,'tiktok');assert.equal(a.referrer_host,'tiktok.com');assert.equal(a.phone,undefined);assert.ok(!JSON.stringify(a).includes('secret'));
 assert.deepEqual(safeMetadata({name:'Private Person',phone:'966501234567',email:'a@b.sa',occasion:'زواج'}),{occasion:'زواج'});
 assert.equal(normalizeAttribution({}).source,'direct_or_unknown');
});

await test('real PostgreSQL analytics, CRM and permission boundaries',async t=>{
 t.after(()=>pg.close());
 for(const name of(await readdir(new URL('../netlify/database/migrations/',import.meta.url))).sort())await pg.exec(await readFile(new URL('../netlify/database/migrations/'+name+'/migration.sql',import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,name,phone,role) VALUES('admin','Admin','966501112201','admin'),('staff','Staff','966501112202','customer_service'),('customer','Customer','966501112203','customer')");
 const admin=(await createSession('admin')).token,staff=(await createSession('staff')).token,customer=(await createSession('customer')).token;
 await t.test('no consent, bots and forged completion events cannot create analytics',async()=>{
  assert.equal((await handlers['analytics-track'](request('/api/analytics/track',track('page_view','session_no_consent',{consent:false})))).status,202);
  assert.equal((await handlers['analytics-track'](request('/api/analytics/track',track('page_view'),'','POST','Googlebot'))).status,202);
  assert.equal((await handlers['analytics-track'](request('/api/analytics/track',track('prebooking_completed')))).status,400);
  assert.equal((await pg.query('SELECT COUNT(*)::int count FROM page_views')).rows[0].count,0);
 });
 await t.test('private invitation tokens and portal paths are ignored before database writes',async()=>{
  for(const path of ['/i/PRIVATE_GUEST_TOKEN','/guest.html?code=PRIVATE_GUEST_TOKEN','/admin.html','/dashboard','/customer.html']){
   assert.equal((await handlers['analytics-track'](request('/api/analytics/track',track('page_view','session_private_0001',{path})))).status,202);
  }
  assert.equal((await pg.query('SELECT COUNT(*)::int count FROM page_views')).rows[0].count,0);
 });
 await t.test('real events deduplicate by event id, strip PII and distinguish browser visitors from sessions',async()=>{
  const first=track('page_view');assert.equal((await handlers['analytics-track'](request('/api/analytics/track',first))).status,201);
  assert.equal((await handlers['analytics-track'](request('/api/analytics/track',first))).status,200);
  assert.equal((await handlers['analytics-track'](request('/api/analytics/track',track('page_view','session_tracking_0002')))).status,201);
  await handlers['analytics-track'](request('/api/analytics/track',track('booking_started','session_tracking_0001',{metadata:{name:'Private',occasion:'زواج'}})));
  const rows=(await pg.query('SELECT * FROM page_views')).rows;assert.equal(rows.length,3);assert.equal(rows[2].metadata.name,undefined);assert.ok(rows.every(r=>r.environment===environment));
  await pg.query("INSERT INTO page_views(id,session_id,event_name,path,environment) VALUES('legacy','legacy_session','page_view','/','legacy_unclassified'),('production','production_session','page_view','/','production')");
 });
 let leadId;
 await t.test('genuine contact submission is stored once and marketing consent stays independent',async()=>{
  const b={phone:'0532763736',name:'أيمن',kind:'launch',idempotencyKey:'launch_interest_0000001',marketingConsent:false,sessionId:'session_tracking_0001',attribution:{utm_source:'TikTok'}};
  const r=await handlers.leads(request('/api/leads',b));assert.equal(r.status,201);leadId=(await r.json()).id;
  const again=await handlers.leads(request('/api/leads',{...b,idempotencyKey:'launch_interest_0000002',marketingConsent:true}));assert.equal(again.status,200);assert.equal((await again.json()).id,leadId);
  const row=(await pg.query('SELECT * FROM leads WHERE id=$1',[leadId])).rows[0];assert.equal(row.phone,'966532763736');assert.equal(row.marketing_consent,true);assert.equal(row.source.source,'tiktok');
  assert.equal((await pg.query("SELECT count(*)::int count FROM page_views WHERE event_name='launch_subscribed'")).rows[0].count,1);
  assert.equal((await handlers.leads(request('/api/leads',{kind:'contact',phone:'0500000000',idempotencyKey:'invalid_interest_00001'}))).status,400);
  assert.equal((await handlers.leads(request('/api/leads',{kind:'contact',email:'fake@example.com',idempotencyKey:'invalid_interest_00002'}))).status,400);
 });
 await t.test('staff sees and updates CRM with durable audit but customers and anonymous users cannot',async()=>{
  assert.equal((await handlers['admin-leads'](request('/api/admin/leads',undefined))).status,401);
  assert.equal((await handlers['admin-leads'](request('/api/admin/leads',undefined,customer))).status,403);
  const view=await handlers['admin-leads'](request('/api/admin/leads',undefined,staff));assert.equal(view.status,200);assert.equal((await view.json()).leads.length,1);
  const patch=await handlers['admin-leads'](request('/api/admin/leads',{id:leadId,contactStatus:'contacted',assignedUserId:'staff',notes:'تم التواصل'},staff,'PATCH'));assert.equal(patch.status,200);
  assert.equal((await pg.query("SELECT count(*)::int count FROM audit_log WHERE action='lead.follow_up'")).rows[0].count,1);
  assert.equal((await handlers['admin-leads'](request('/api/admin/leads',{id:leadId,role:'admin'},staff,'PATCH'))).status,400);
 });
 await t.test('dashboard excludes preview cross-environment rows and test or unclassified payments',async()=>{
  await pg.exec("INSERT INTO events(id,owner_token,title,occasion) VALUES('event-1','fixture-owner-1','Fixture','زواج'),('event-2','fixture-owner-2','Fixture','زواج'),('event-3','fixture-owner-3','Fixture','زواج'),('event-4','fixture-owner-4','Fixture','زواج')");
  await pg.query("INSERT INTO payment_orders(id,event_id,user_id,package_code,amount,status,payment_mode,environment) VALUES('live-order','event-1','customer','hala_basic',23400,'paid','live',$1),('test-order','event-2','customer','hala_basic',99900,'paid','test',$1),('unknown-order','event-3','customer','hala_basic',11100,'paid','unknown','legacy_unclassified'),('other-order','event-4','customer','hala_basic',88800,'paid','live','production')",[environment]);
  assert.equal((await handlers['admin-insights'](request('/api/admin/insights',undefined,customer))).status,403);
  const response=await handlers['admin-insights'](request('/api/admin/insights',undefined,staff));assert.equal(response.status,200);const d=await response.json();
  assert.equal(d.visits.total,2);assert.equal(d.visits.sessions,2);assert.equal(d.visits.estimatedVisitors,1);assert.equal(d.scope.legacyUnclassified.pageViews,1);
  assert.equal(d.interests.knownLeads,1);assert.equal(d.interests.marketingOptedIn,1);assert.equal(d.bookings.total,0);assert.equal(d.bookings.realizedRevenueHalalas,23400);
  assert.equal(d.conversion.visitToBookingStartPercent,50);assert.equal(d.conversion.bookingCompletionPercent,0);
 });
 await t.test('per-session burst guard rejects the 31st distinct event and does not accept forged environment',async()=>{
  for(let i=0;i<30;i++)assert.equal((await handlers['analytics-track'](request('/api/analytics/track',track('package_viewed','session_rate_limit_0001',{environment:'production'})))).status,201);
  assert.equal((await handlers['analytics-track'](request('/api/analytics/track',track('package_viewed','session_rate_limit_0001')))).status,429);
  assert.equal((await pg.query("SELECT count(*)::int count FROM page_views WHERE session_id='session_rate_limit_0001' AND environment=$1",[environment])).rows[0].count,30);
 });
 await t.test('marketing invitation clicks retain the source page without personal query data',async()=>{
  const body=track('invitation_cta_clicked','session_marketing_0001',{path:'/wedding-invitations-en.html?email=private@example.com',metadata:{occasion:'wedding',service:'invitation_builder',email:'private@example.com',guest:'Private Guest'}});
  assert.equal((await handlers['analytics-track'](request('/api/analytics/track',body))).status,201);
  const row=(await pg.query('SELECT path,metadata FROM page_views WHERE session_id=$1',['session_marketing_0001'])).rows[0];
  assert.equal(row.path,'/wedding-invitations-en.html');
  assert.deepEqual(row.metadata,{occasion:'wedding',service:'invitation_builder'});
  assert.ok(!JSON.stringify(row).includes('private@example.com'));
 });
});
