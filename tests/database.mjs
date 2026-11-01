import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { PGlite } from '@electric-sql/pglite';

// Run the shipped handlers and migrations on embedded PostgreSQL. All provider calls
// are replaced; this validates SQL/authorization, not a remote database or mobile UI.
registerHooks({resolve(specifier,context,next){
  if(specifier==='@netlify/database')return {url:'data:text/javascript,export function getDatabase(){return globalThis.__HALA_DB__}',shortCircuit:true};
  return next(specifier,context);
}});
const postgres=new PGlite();
let tail=Promise.resolve();
async function acquire(){const previous=tail;let unlock;tail=new Promise(resolve=>{unlock=resolve;});await previous;return unlock;}
const db={
  sql:async(parts,...values)=>{const unlock=await acquire();try{return (await postgres.query(parts.reduce((sql,part,index)=>sql+(index?'$'+index:'')+part,''),values)).rows;}finally{unlock();}},
  pool:{connect:async()=>{const unlock=await acquire();return {query:(sql,args)=>postgres.query(sql,args),release:unlock};}}
};
globalThis.__HALA_DB__=db;
const env={HALA_OTP_SECRET:'synthetic-otp-secret-for-database-tests-only',HALA_ADMIN_PHONES:'966501112234',D360_MODE:'production',D360_API_KEY:'synthetic-provider-key',D360_WEBHOOK_TOKEN:'synthetic-webhook-token',D360_INVITE_TEMPLATE:'test_invite',D360_TEMPLATE_LANGUAGE:'ar'};
globalThis.Netlify={env:{get:key=>env[key]}};
const request=(path,body,token='',method='POST')=>new Request('https://staging.example'+path,{method,headers:{'content-type':'application/json',origin:'https://staging.example',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const handlers={};
for(const name of ['create-event','add-guest','rsvp','check-in','get-invite','auth-otp-verify','whatsapp-send','payment-order','admin-users','admin-events'])handlers[name]=(await import('../netlify/functions/'+name+'.mts')).default;
const {createSession,canAccessEvent}=await import('../netlify/functions/_shared/auth.mjs');
const {hashOtp,issueOtp}=await import('../netlify/functions/_shared/otp.mjs');
const {recordAcquisition}=await import('../netlify/functions/_shared/partners.mjs');

await test('embedded PostgreSQL migrations and real HALA handlers',async t=>{
  t.after(()=>postgres.close());
  const migrations=new URL('../netlify/database/migrations/',import.meta.url);
  await t.test('all tracked schema migrations apply in order',async()=>{
    for(const directory of (await readdir(migrations)).sort())await postgres.exec(await readFile(new URL(directory+'/migration.sql',migrations),'utf8'));
    const columns=await postgres.query("SELECT column_name FROM information_schema.columns WHERE table_name='whatsapp_messages'");
    assert.ok(columns.rows.some(row=>row.column_name==='trial_user_id'));
  });
  await postgres.query("INSERT INTO users(id,name,phone,role) VALUES('customer','عميل','966501112233','customer'),('supervisor','مشرف','966501112235','supervisor')");
  const customerSession=await createSession('customer'),supervisorSession=await createSession('supervisor');
  let firstEvent,secondEvent,firstGuest,secondGuest,adminToken;
  const customDesign={image:'data:image/jpeg;base64,YWJj',audio:'data:audio/mpeg;base64,YWJj',font:'serif',headline:'مخصص'};
  await t.test('customer creates events and guests; unrelated account cannot mutate them',async()=>{
    const first=await handlers['create-event'](request('/api/events',{title:'تجربة حضور',name1:'أيمن',occasion:'تجمع ونشاط',capacity:1,waitlistEnabled:true,design:customDesign},customerSession.token));
    assert.equal(first.status,200);firstEvent=(await first.json()).event;
    const created=await handlers['add-guest'](request('/api/guests',{eventId:firstEvent.id,guests:[{name:'الضيف الأول',phone:'0500000001'},{name:'الضيف الثاني',phone:'0500000002'}]},customerSession.token));
    assert.equal(created.status,200);[firstGuest,secondGuest]=(await created.json()).guests;
    const denied=await handlers['add-guest'](request('/api/guests',{eventId:firstEvent.id,name:'غير مصرح'},supervisorSession.token));
    assert.equal(denied.status,403);
    const second=await handlers['create-event'](request('/api/events',{title:'تجربة ثانية',name1:'أيمن',occasion:'زفاف'},customerSession.token));
    assert.equal(second.status,200);secondEvent=(await second.json()).event;
  });
  await t.test('custom image, music and text survive event persistence and invitation retrieval',async()=>{
    const response=await handlers['get-invite'](request('/api/invite?code='+firstGuest.code,undefined,'','GET'));
    assert.equal(response.status,200);
    assert.deepEqual((await response.json()).invite.design_json,customDesign);
  });
  await t.test('RSVP fills capacity, waitlists the next guest, and invitation reads reflect it',async()=>{
    const first=await handlers.rsvp(request('/api/rsvp',{code:firstGuest.code,status:'accepted'}));
    assert.equal(first.status,200);assert.equal((await first.json()).guest.attendance_state,'normal');
    const second=await handlers.rsvp(request('/api/rsvp',{code:secondGuest.code,status:'accepted'}));
    assert.equal(second.status,200);assert.equal((await second.json()).guest.attendance_state,'waitlist');
    const invite=await handlers['get-invite'](request('/api/invite?code='+secondGuest.code,undefined,'','GET'));
    assert.equal(invite.status,200);assert.equal((await invite.json()).invite.attendance_state,'waitlist');
  });
  await t.test('QR records one timestamp and identifies repeat scans',async()=>{
    const scan=()=>handlers['check-in'](request('/api/check-in',{eventId:firstEvent.id,code:'https://staging.example/i/'+firstGuest.code},customerSession.token));
    const first=await scan(),firstBody=await first.json();
    assert.equal(first.status,200);assert.equal(firstBody.alreadyCheckedIn,false);
    const second=await scan(),secondBody=await second.json();
    assert.equal(second.status,200);assert.equal(secondBody.alreadyCheckedIn,true);
    assert.equal(firstBody.guest.checked_in_at,secondBody.guest.checked_in_at);
    assert.equal((await handlers['check-in'](request('/api/check-in',{eventId:secondEvent.id,code:firstGuest.code},customerSession.token))).status,404);
  });
  await t.test('supervisor assignment grants attendance only and stale role cannot retain assignment',async()=>{
    await postgres.query("INSERT INTO event_members(event_id,user_id,member_role) VALUES($1,'supervisor','supervisor')",[firstEvent.id]);
    assert.equal(await canAccessEvent({id:'supervisor',role:'supervisor'},firstEvent.id),true);
    assert.equal(await canAccessEvent({id:'supervisor',role:'customer'},firstEvent.id),false);
    const denied=await handlers['add-guest'](request('/api/guests',{eventId:firstEvent.id,guestId:firstGuest.id},supervisorSession.token,'DELETE'));
    assert.equal(denied.status,403);
  });
  await t.test('free WhatsApp trial is shared across customer events and acceptance remains queued',async()=>{
    let providerCalls=0;const previousFetch=globalThis.fetch;
    globalThis.fetch=async()=>{providerCalls++;return Response.json({messages:[{id:'wamid.synthetic'}]});};
    try{
      const sent=await handlers['whatsapp-send'](request('/api/whatsapp/send',{eventId:firstEvent.id,guestId:firstGuest.id},customerSession.token));
      assert.equal(sent.status,202);assert.equal((await sent.json()).deliveryConfirmed,false);
      const added=await handlers['add-guest'](request('/api/guests',{eventId:secondEvent.id,name:'ضيف المناسبة الثانية',phone:'0500000003'},customerSession.token));
      const other=(await added.json()).guest;
      const blocked=await handlers['whatsapp-send'](request('/api/whatsapp/send',{eventId:secondEvent.id,guestId:other.id},customerSession.token));
      assert.equal(blocked.status,402);assert.equal(providerCalls,1);
      const rows=await postgres.query("SELECT status,trial_user_id FROM whatsapp_messages");
      assert.equal(rows.rows[0].status,'queued');assert.equal(rows.rows[0].trial_user_id,'customer');
    }finally{globalThis.fetch=previousFetch;}
  });
  await t.test('deleting a trial guest cannot reset the free allowance',async()=>{
    assert.equal((await handlers['add-guest'](request('/api/guests',{eventId:firstEvent.id,guestId:firstGuest.id},customerSession.token,'DELETE'))).status,200);
    assert.equal((await postgres.query("SELECT COUNT(*)::int count FROM customer_free_trials WHERE user_id='customer'")).rows[0].count,1);
    const added=await handlers['add-guest'](request('/api/guests',{eventId:secondEvent.id,name:'ضيف بديل',phone:'0500000004'},customerSession.token));
    const guest=(await added.json()).guest;
    const response=await handlers['whatsapp-send'](request('/api/whatsapp/send',{eventId:secondEvent.id,guestId:guest.id},customerSession.token));
    assert.equal(response.status,402);
  });
  await t.test('payment remains disabled without producing an order or provider request',async()=>{
    const response=await handlers['payment-order'](request('/api/payments/order',{eventId:firstEvent.id,packageCode:'hala_plus'},customerSession.token));
    assert.equal(response.status,503);
    assert.equal((await postgres.query('SELECT COUNT(*)::int count FROM payment_orders')).rows[0].count,0);
  });
  await t.test('paid package capacity applies to legacy and account callers inside the insert transaction',async()=>{
    await postgres.query("INSERT INTO payment_orders(id,event_id,user_id,package_code,amount,status) VALUES('package-capacity',$1,'customer','start',2900,'paid')",[firstEvent.id]);
    await postgres.query("INSERT INTO guests(id,event_id,name,code) SELECT 'limit-'||n,$1,'ضيف حد الباقة','LIMIT'||n FROM generate_series(1,49) n",[firstEvent.id]);
    const response=await handlers['add-guest'](request('/api/guests',{eventId:firstEvent.id,name:'فوق حد الباقة'},customerSession.token));
    assert.equal(response.status,409);assert.equal((await response.json()).code,'PACKAGE_GUEST_LIMIT');
  });
  await t.test('commission reconciliation records one durable acquisition despite retries and later orders',async()=>{
    await postgres.query("INSERT INTO users(id,name,role) VALUES('partner','شريك','partner')");
    await postgres.query("INSERT INTO partner_profiles(user_id,kind,code,discount_bps) VALUES('partner','influencer','SYNTHETIC',1000)");
    await postgres.query("UPDATE payment_orders SET referral_partner_id='partner',commission_amount=290 WHERE id='package-capacity'");
    const order=(await postgres.query("SELECT * FROM payment_orders WHERE id='package-capacity'")).rows[0];
    await recordAcquisition(db,order);await recordAcquisition(db,order);
    await postgres.query("INSERT INTO payment_orders(id,event_id,user_id,package_code,amount,status,referral_partner_id,commission_amount) VALUES('later-order',$1,'customer','basic',8910,'paid','partner',891)",[secondEvent.id]);
    await recordAcquisition(db,(await postgres.query("SELECT * FROM payment_orders WHERE id='later-order'")).rows[0]);
    const rows=await postgres.query("SELECT order_id,amount FROM partner_commissions");
    assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].amount,290);assert.equal(rows.rows[0].order_id,'package-capacity');
  });
  await t.test('OTP issuance cooldown and admin preclaim regression use real SQL',async()=>{
    const issued=await issueOtp('966501112236');assert.equal(issued.ok,true);
    assert.equal((await issueOtp('966501112236')).status,429);
    await postgres.query("INSERT INTO users(id,name,email,phone,password_salt,password_hash,role) VALUES('preclaimed','unverified','synthetic@example.test','966501112234','legacy-salt','legacy-hash','customer')");
    const stale=await createSession('preclaimed');
    await postgres.query("INSERT INTO otp_codes(id,phone,code_hash,expires_at) VALUES('admin-otp','966501112234',$1,NOW()+INTERVAL '5 minutes')",[await hashOtp('966501112234','123456')]);
    const verified=await handlers['auth-otp-verify'](request('/api/auth/otp/verify',{phone:'966501112234',code:'123456'}));
    assert.equal(verified.status,200);const payload=await verified.json();assert.equal(payload.user.role,'admin');adminToken=payload.token;
    const user=(await postgres.query("SELECT role,password_hash,password_salt FROM users WHERE id='preclaimed'")).rows[0];
    assert.equal(user.role,'admin');assert.equal(user.password_hash,null);
    const {getAuth}=await import('../netlify/functions/_shared/auth.mjs');
    assert.equal(await getAuth(request('/api/auth/me',undefined,stale.token,'GET')),null);
  });
  await t.test('admin event catalog supports search, pagination and safe detail; customer is denied',async()=>{
    const forbidden=await handlers['admin-events'](request('/api/admin/events',undefined,customerSession.token,'GET'));
    assert.equal(forbidden.status,403);
    const response=await handlers['admin-events'](request('/api/admin/events?limit=1&page=1',undefined,adminToken,'GET'));
    assert.equal(response.status,200);const page=await response.json();
    assert.equal(page.events.length,1);assert.equal(page.hasMore,true);assert.equal(page.page,1);
    assert.equal(page.events[0].owner_name,'عميل');
    const detail=await handlers['admin-events'](request('/api/admin/events?eventId='+firstEvent.id,undefined,adminToken,'GET'));
    const {event}=await detail.json();assert.equal(detail.status,200);assert.equal(event.guest_count,50);assert.equal(event.owner_token,undefined);
    const search=await handlers['admin-events'](request('/api/admin/events?q='+encodeURIComponent('غير موجود'),undefined,adminToken,'GET'));
    assert.deepEqual((await search.json()).events,[]);
    assert.equal((await handlers['admin-events'](request('/api/admin/events?eventId=missing',undefined,adminToken,'GET'))).status,404);
  });
  await t.test('admin user lifecycle revokes disabled customer, supervisor and partner sessions without targeting admins',async()=>{
    const update=(userId,status,token=adminToken)=>handlers['admin-users'](request('/api/admin/users',{userId,status},token,'PATCH'));
    assert.equal((await update('supervisor','suspended',customerSession.token)).status,403);
    assert.equal((await update('preclaimed','suspended')).status,409);
    assert.equal((await update('missing','suspended')).status,404);
    assert.equal((await update('customer','other')).status,400);
    const {getAuth}=await import('../netlify/functions/_shared/auth.mjs');
    for(const id of ['customer','supervisor','partner']){
      const token=(await createSession(id)).token;
      const paused=await update(id,'suspended');assert.equal(paused.status,200);assert.equal((await paused.json()).user.status,'suspended');
      assert.equal(await getAuth(request('/api/auth/me',undefined,token,'GET')),null);
      assert.equal((await postgres.query('SELECT COUNT(*)::int count FROM sessions WHERE user_id=$1',[id])).rows[0].count,0);
      const active=await update(id,'active');assert.equal(active.status,200);assert.equal((await active.json()).user.status,'active');
      // Reactivating does not resurrect a revoked token.
      assert.equal(await getAuth(request('/api/auth/me',undefined,token,'GET')),null);
    }
    const actions=await postgres.query("SELECT metadata FROM audit_log WHERE action='admin.user_status'");
    assert.equal(actions.rows.length,6);
  });

});
