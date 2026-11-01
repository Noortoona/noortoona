import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {normalizeCatalog,applyCatalogPatch,TEMPLATE_KEYS,availableTemplate} from '../netlify/functions/_shared/catalog.mjs';

test('catalog validation rejects unknown packages, unbounded values, hidden groups and malformed services',()=>{
  const defaults=normalizeCatalog();
  for(const patch of [{packages:[{code:'basic',amount:14900,guestLimit:100}]},{packages:[{code:'hala_basic',amount:0,guestLimit:100}]},{packages:[{code:'hala_basic',amount:14900.5,guestLimit:100}]},{packages:[{code:'hala_basic',amount:14900,guestLimit:99999}]},{hiddenTemplateKeys:['unknown:fake']},{hiddenTemplateKeys:TEMPLATE_KEYS.filter(t=>t.group==='wedding').map(t=>t.key)},{services:[{id:'bad/id',name:'صالح',description:'',enabled:true}]},{services:[{id:'valid',name:'خدمة',description:'',enabled:'yes'}]}])assert.throws(()=>applyCatalogPatch(defaults,patch));
});

test('server template identifiers remain identical to actual shared invitation art',async()=>{
  const sandbox={window:{},URL};vm.runInNewContext(await readFile(new URL('../invitation-renderer.js',import.meta.url),'utf8'),sandbox);
  const keys=Object.entries(sandbox.window.NOORTOONA.catalog).flatMap(([group,templates])=>templates.map(t=>group+':'+t.name)).sort();
  assert.deepEqual(keys,TEMPLATE_KEYS.map(t=>t.key).sort());
  const catalog=applyCatalogPatch(normalizeCatalog(),{hiddenTemplateKeys:['wedding:ليلة كحلية']});
  assert.equal(availableTemplate(catalog,{},'ليلة كحلية'),false);
});

registerHooks({resolve(specifier,context,next){
  if(specifier==='@netlify/database')return {url:'data:text/javascript,export function getDatabase(){return globalThis.__HALA_CATALOG_DB__}',shortCircuit:true};
  return next(specifier,context);
}});
const pg=new PGlite();
let tail=Promise.resolve();
async function acquire(){let release;const previous=tail;tail=new Promise(resolve=>release=resolve);await previous;return release}
const db={sql:async(parts,...values)=>{const release=await acquire();try{return(await pg.query(parts.reduce((sql,part,index)=>sql+(index?'$'+index:'')+part,''),values)).rows}finally{release()}},pool:{connect:async()=>{const release=await acquire();return{query:(sql,args)=>pg.query(sql,args),release}}}};
globalThis.__HALA_CATALOG_DB__=db;
const env={HALA_PAYMENT_MODE:'test',MOYASAR_PUBLISHABLE_KEY:'pk_test_catalog_fixture',MOYASAR_SECRET_KEY:'sk_test_catalog_fixture'};
globalThis.Netlify={env:{get:key=>env[key]}};
const handlers={};for(const name of ['catalog','admin-catalog','pricing-quote','referral-quote','payment-order','add-guest','create-event','supervisor-addon','admin-supervisors'])handlers[name]=(await import('../netlify/functions/'+name+'.mts')).default;
const {createSession}=await import('../netlify/functions/_shared/auth.mjs');
const request=(path,body,token='',method=body?'PATCH':'GET')=>new Request('https://staging.example'+path,{method,headers:{origin:'https://staging.example','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});

await test('catalog handlers persist real configuration and preserve order entitlements',async t=>{
  t.after(()=>pg.close());
  for(const name of(await readdir(new URL('../netlify/database/migrations/',import.meta.url))).sort())await pg.exec(await readFile(new URL('../netlify/database/migrations/'+name+'/migration.sql',import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,name,phone,role) VALUES('admin','Admin','966501110001','admin'),('customer','Customer','966501110002','customer'),('partner','Partner','966501110003','partner')");
  const admin=(await createSession('admin')).token,customer=(await createSession('customer')).token;
  let firstOrder,event;
  await t.test('public defaults omit disabled services and admin mutation requires actual admin',async()=>{
    const response=await handlers.catalog(request('/api/catalog'));
    assert.equal(response.status,200);const data=await response.json();assert.equal(data.packages[0].amount,44900);assert.equal(data.services.length,6);
    assert.equal((await handlers['admin-catalog'](request('/api/admin/catalog',{services:[]},customer))).status,403);
    assert.equal((await handlers['admin-catalog'](request('/api/admin/catalog',{services:[]}))).status,401);
    const adminView=await handlers['admin-catalog'](request('/api/admin/catalog',undefined,admin));assert.equal((await adminView.json()).templateKeys.length,84);
  });
  await t.test('prices, services and template visibility persist and stale revision cannot overwrite them',async()=>{
    const response=await handlers['admin-catalog'](request('/api/admin/catalog',{expectedRevision:0,packages:[{code:'hala_basic',amount:19900,guestLimit:3}],hiddenTemplateKeys:['wedding:ليلة كحلية'],services:[{id:'venues',name:'قاعات هلا',description:'خدمة مخصصة',enabled:true},{id:'paused',name:'خدمة موقوفة',description:'',enabled:false}]},admin));
    assert.equal(response.status,200);assert.equal((await response.json()).revision,1);
    const publicView=await(await handlers.catalog(request('/api/catalog'))).json();assert.equal(publicView.packages[0].amount,19900);assert.equal(publicView.packages[0].guestLimit,3);assert.equal(publicView.services.length,1);assert.equal(publicView.services[0].name,'قاعات هلا');assert.deepEqual(publicView.hiddenTemplateKeys,['wedding:ليلة كحلية']);
    assert.equal((await handlers['admin-catalog'](request('/api/admin/catalog',{expectedRevision:0,services:[]},admin))).status,409);
    assert.equal((await pg.query("SELECT count(*)::int count FROM audit_log WHERE action='admin.catalog_updated'")).rows[0].count,1);
  });
  await t.test('new event cannot select a hidden canonical template and uses configured package',async()=>{
    const payload={name1:'أحمد',name2:'سارة',occasion:'زواج',title:'حفل',package:'hala_basic',template:'ليلة كحلية',design:{occasionKey:'wedding'}};
    assert.equal((await handlers['create-event'](request('/api/events',payload,customer,'POST'))).status,400);
    const response=await handlers['create-event'](request('/api/events',{...payload,template:'حديقة اللؤلؤ'},customer,'POST'));
    assert.equal(response.status,200);event=(await response.json()).event;assert.equal(event.package_name,'هلا الأساسية');
  });
  await t.test('quote, referral and order all use admin-configured server price with immutable guest limit',async()=>{
    const quote=await(await handlers['pricing-quote'](request('/api/pricing/quote?package=hala_basic'))).json();assert.equal(quote.baseAmount,19900);
    await pg.exec("INSERT INTO partner_profiles(user_id,kind,code,discount_bps,commission_bps) VALUES('partner','influencer','CATALOG10',1000,1000)");
    const referral=await(await handlers['referral-quote'](request('/api/referrals/quote?package=hala_basic&code=CATALOG10',undefined,customer))).json();assert.equal(referral.discountAmount,1990);assert.equal(referral.discountedPackageAmount,17910);
    const response=await handlers['payment-order'](request('/api/payments/order',{eventId:event.id,packageCode:'hala_basic',amount:1},customer,'POST'));
    assert.equal(response.status,201);firstOrder=(await response.json()).order;assert.equal(firstOrder.amount,19900);assert.equal(firstOrder.guest_limit,3);
    await pg.query("UPDATE payment_orders SET status='paid' WHERE id=$1",[firstOrder.id]);
  });
  await t.test('later price/limit changes do not alter an existing paid entitlement',async()=>{
    assert.equal((await handlers['admin-catalog'](request('/api/admin/catalog',{packages:[{code:'hala_basic',amount:24900,guestLimit:1}]},admin))).status,200);
    const added=await handlers['add-guest'](request('/api/guests',{eventId:event.id,guests:[{name:'الأول'},{name:'الثاني'},{name:'الثالث'}]},customer,'POST'));assert.equal(added.status,200);
    const extra=await handlers['add-guest'](request('/api/guests',{eventId:event.id,name:'الرابع'},customer,'POST'));assert.equal(extra.status,409);
    const order=(await pg.query('SELECT amount,guest_limit FROM payment_orders WHERE id=$1',[firstOrder.id])).rows[0];assert.equal(order.amount,19900);assert.equal(order.guest_limit,3);
  });
  await t.test('supervisor preference persists for male and female, prices599 and preserves prior299 requests',async()=>{
    await pg.query("UPDATE platform_settings SET value='599' WHERE key='supervisor_addon_sar'");
    const payload={name1:'المناسبة',occasion:'زواج',title:'اختبار مشرف',package:'hala_plus',template:'حديقة اللؤلؤ',design:{occasionKey:'wedding'},requestSupervisor:true};
    for(const invalid of [undefined,'other'])assert.equal((await handlers['create-event'](request('/api/events',{...payload,supervisorPreference:invalid},customer,'POST'))).status,400);
    for(const preference of ['male','female']){
      const created=await handlers['create-event'](request('/api/events',{...payload,supervisorPreference:preference},customer,'POST'));
      assert.equal(created.status,200);const ev=(await created.json()).event;assert.equal(ev.design_json.supervisorPreference,preference);
      const requestView=await(await handlers['supervisor-addon'](request('/api/events/supervisor?eventId='+ev.id,undefined,customer))).json();assert.equal(requestView.preference,preference);assert.equal(requestView.request.amount,59900);
      const adminView=await(await handlers['admin-supervisors'](request('/api/admin/supervisors',undefined,admin))).json();assert.equal(adminView.requests.find(r=>r.event_id===ev.id).supervisor_preference,preference);
      await pg.query("UPDATE supervisor_requests SET amount=29900 WHERE event_id=$1",[ev.id]);
      const response=await handlers['payment-order'](request('/api/payments/order',{eventId:ev.id,packageCode:'hala_plus'},customer,'POST'));
      assert.equal(response.status,201);const order=(await response.json()).order;assert.equal(order.amount,139800);assert.equal(order.supervisor_addon_amount,29900);
      assert.equal((await pg.query('SELECT amount FROM supervisor_requests WHERE event_id=$1',[ev.id])).rows[0].amount,29900);
    }
    const attachPayload={name1:'إضافة مشرف',occasion:'أخرى',package:'hala_plus'};
    const ev=(await(await handlers['create-event'](request('/api/events',attachPayload,customer,'POST'))).json()).event;
    assert.equal((await handlers['supervisor-addon'](request('/api/events/supervisor',{eventId:ev.id,requested:true},customer,'POST'))).status,400);
    assert.equal((await handlers['supervisor-addon'](request('/api/events/supervisor',{eventId:ev.id,requested:true,supervisorPreference:'female'},customer,'POST'))).status,201);
    const updated=await(await handlers['supervisor-addon'](request('/api/events/supervisor?eventId='+ev.id,undefined,customer))).json();assert.equal(updated.preference,'female');assert.equal(updated.request.amount,59900);
  });
});
