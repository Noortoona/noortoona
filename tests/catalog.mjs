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

await test('catalog handlers persist policy, protect mutation and validate template visibility',async t=>{
 t.after(()=>pg.close());
 for(const name of(await readdir(new URL('../netlify/database/migrations/',import.meta.url))).sort())await pg.exec(await readFile(new URL('../netlify/database/migrations/'+name+'/migration.sql',import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,name,phone,role) VALUES('admin','Admin','966501110001','admin'),('customer','Customer','966501110002','customer')");
 const admin=(await createSession('admin')).token,customer=(await createSession('customer')).token;
 assert.equal((await handlers['admin-catalog'](request('/api/admin/catalog',{services:[]}))).status,401);
 assert.equal((await handlers['admin-catalog'](request('/api/admin/catalog',{services:[]},customer))).status,403);
 const initial=await(await handlers.catalog(request('/api/catalog'))).json();assert.equal(initial.version,2);assert.equal(initial.packages[0].priceTiers[100],39900);
 const patch={expectedRevision:0,packages:[{code:'hala_basic',priceTiers:{100:49900,250:89900,500:149900},enabled:true}],hiddenTemplateKeys:['wedding:ليلة كحلية']};
 const saved=await handlers['admin-catalog'](request('/api/admin/catalog',patch,admin));assert.equal(saved.status,200);
 assert.equal((await handlers['admin-catalog'](request('/api/admin/catalog',patch,admin))).status,409);
 const next=await(await handlers.catalog(request('/api/catalog'))).json();assert.equal(next.packages[0].priceTiers[250],89900);
 const hidden=await handlers['create-event'](request('/api/events',{name1:'أحمد',package:'hala_basic',template:'ليلة كحلية',design:{occasionKey:'wedding'}},customer,'POST'));assert.equal(hidden.status,400);
 const audit=(await pg.query("SELECT metadata FROM audit_log WHERE action='admin.catalog_updated'")).rows[0].metadata;assert.equal(audit.before.packages[0].priceTiers[100],39900);assert.equal(audit.after.packages[0].priceTiers[100],49900);
});
