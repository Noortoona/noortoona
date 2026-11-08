import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import { extractIncoming } from '../netlify/functions/_shared/whatsapp.mjs';

registerHooks({resolve(specifier,context,next){
  if(specifier==='@netlify/database')return {url:'data:text/javascript,export function getDatabase(){return globalThis.__managementDb}',shortCircuit:true};
  return next(specifier,context);
}});
const pg=new PGlite();
const db={sql:async(parts,...values)=>(await pg.query(parts.reduce((sql,part,index)=>sql+(index?'$'+index:'')+part,''),values)).rows,
  pool:{connect:async()=>({query:(sql,args)=>pg.query(sql,args),release:()=>{}})}};
globalThis.__managementDb=db;
const env={D360_MODE:'sandbox',D360_API_KEY:'synthetic-key',D360_WEBHOOK_TOKEN:'synthetic-webhook-token',HALA_OTP_SECRET:'synthetic-otp-secret-32-characters',CONTEXT:'deploy-preview'};
globalThis.Netlify={env:{get:key=>env[key]}};
const webhook=(await import('../netlify/functions/whatsapp-webhook.mts')).default;
const management=(await import('../netlify/functions/admin-whatsapp.mts')).default;
const {createSession}=await import('../netlify/functions/_shared/auth.mjs');
const req=(path,body,token='',method='POST')=>new Request('https://preview.example'+path,{method,headers:{origin:'https://preview.example',authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const incoming={entry:[{changes:[{value:{metadata:{display_phone_number:'966510654663'},messages:[{id:'wamid.incoming',from:'966500000001',type:'text',text:{body:'اختبار <script> 123456'},timestamp:String(Math.floor(Date.now()/1000))}]}}]}]};

await test('WhatsApp management on embedded PostgreSQL, with real handlers',async t=>{
  t.after(()=>pg.close());
  for(const directory of (await readdir(new URL('../netlify/database/migrations/',import.meta.url))).sort())await pg.exec(await readFile(new URL('../netlify/database/migrations/'+directory+'/migration.sql',import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,name,phone,role) VALUES('admin-wa','Admin','966500000009','admin'),('customer-wa','Customer','966500000008','customer')");
  const admin=await createSession('admin-wa'),customer=await createSession('customer-wa');
  await t.test('authentication protects incoming messages before any persistence',async()=>{
    assert.equal((await webhook(req('/api/whatsapp/webhook',incoming,'wrong'))).status,401);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM whatsapp_inbox')).rows[0].n,0);
  });
  await t.test('incoming retries persist exactly once; six-digit codes are redacted',async()=>{
    for(let i=0;i<2;i++)assert.equal((await webhook(req('/api/whatsapp/webhook',incoming,env.D360_WEBHOOK_TOKEN))).status,200);
    const rows=(await pg.query('SELECT * FROM whatsapp_inbox')).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].recipient_phone,'966510654663');
    assert.ok(!rows[0].body.includes('123456'));assert.ok(rows[0].body.includes('[رمز محجوب]'));
    assert.equal((await pg.query('SELECT observed_phone FROM whatsapp_webhook_state')).rows[0].observed_phone,'966510654663');
  });
  await t.test('anonymous users and customers cannot read inbox or diagnostics',async()=>{
    assert.equal((await management(req('/api/admin/whatsapp',undefined,'','GET'))).status,401);
    assert.equal((await management(req('/api/admin/whatsapp',undefined,customer.token,'GET'))).status,403);
  });
  await t.test('admin sees actual state, masked phone and unverified Meta; sandbox never probes production',async()=>{
    const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No network in tests');};
    try{
      const response=await management(req('/api/admin/whatsapp?probe=true',undefined,admin.token,'GET'));
      assert.equal(response.status,200);const d=await response.json();
      assert.equal(d.official.phone,'966510654663');assert.equal(d.mode,'sandbox');assert.equal(d.meta.status,'unverified');
      assert.equal(d.diagnostics.status,'sandbox');assert.equal(d.sender.ownershipVerified,false);assert.equal(calls,0);
      assert.ok(d.webhook.lastReceivedAt);assert.ok(!JSON.stringify(d).includes('966500000001'));
      assert.ok(!JSON.stringify(d).includes(env.D360_API_KEY));assert.ok(!JSON.stringify(d).includes(env.HALA_OTP_SECRET));
    }finally{globalThis.fetch=original;}
  });
  await t.test('inbox resolution is role-protected, idempotent and rejects cross-origin changes',async()=>{
    const body={action:'resolve',messageId:'wamid.incoming'};
    assert.equal((await management(req('/api/admin/whatsapp',body,customer.token))).status,403);
    const cross=req('/api/admin/whatsapp',body,admin.token);cross.headers.set('origin','https://attacker.example');
    assert.equal((await management(cross)).status,403);
    assert.equal((await (await management(req('/api/admin/whatsapp',body,admin.token))).json()).updated,true);
    assert.equal((await (await management(req('/api/admin/whatsapp',body,admin.token))).json()).updated,false);
    assert.equal((await pg.query('SELECT resolved_by FROM whatsapp_inbox')).rows[0].resolved_by,'admin-wa');
  });
  await t.test('out-of-order OTP callbacks cannot downgrade read status',async()=>{
    await pg.exec("INSERT INTO otp_codes(id,phone,code_hash,expires_at,message_id,delivery_status) VALUES('otp-wa','966500000001','hash',NOW()+INTERVAL '5 minutes','wamid.otp','read')");
    for(const status of ['sent','failed','delivered']){
      assert.equal((await webhook(req('/api/whatsapp/webhook',{statuses:[{id:'wamid.otp',status}]},env.D360_WEBHOOK_TOKEN))).status,200);
      assert.equal((await pg.query("SELECT delivery_status FROM otp_codes WHERE id='otp-wa'")).rows[0].delivery_status,'read');
    }
  });
  await t.test('provider authentication failure never becomes a connection success',async()=>{
    env.D360_MODE='production';const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'unauthorized',secret:env.D360_API_KEY},{status:401});
    try{
      const d=await (await management(req('/api/admin/whatsapp?probe=true',undefined,admin.token,'GET'))).json();
      assert.equal(d.diagnostics.status,'unverified');assert.equal(d.diagnostics.webhook.httpStatus,401);assert.equal(d.diagnostics.productionVerified,false);
      assert.ok(!JSON.stringify(d).includes(env.D360_API_KEY));
    }finally{globalThis.fetch=original;env.D360_MODE='sandbox';}
  });
});

test('incoming normalization rejects malformed envelopes and does not retain media payloads',()=>{
  assert.deepEqual(extractIncoming({messages:[{id:'x',from:'invalid'}]}),[]);
  const rows=extractIncoming({messages:[{id:'image',from:'966500000001',type:'image',image:{id:'sensitive-media-id'}}]});
  assert.equal(rows.length,1);assert.equal(rows[0].body,'');assert.ok(!JSON.stringify(rows).includes('sensitive-media-id'));
});

test('OTP dispatch failure never exposes provider text containing the code',async()=>{
  let source=await readFile(new URL('../netlify/functions/auth-otp-request.mts',import.meta.url),'utf8');
  source=source.replace(/^import .*;\s*$/gm,'');
  const bindings={getDatabase:()=>({sql:async()=>[]}),isSameOriginRequest:()=>true,secureJson:(data,status=200)=>Response.json(data,{status}),
    normalizeLoginPhone:()=> '966500000001',issueOtp:async()=>({ok:true,id:'test',code:'654321'}),sendOtp:async()=>{throw Error('upstream body contained 654321');}};
  globalThis.__otpRedactionBindings=bindings;
  const prefix=Object.keys(bindings).map(key=>'const '+key+'=globalThis.__otpRedactionBindings.'+key+';').join('\n');
  const code=ts.transpileModule(prefix+'\n'+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const handler=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
  const response=await handler(req('/api/auth/otp/request',{phone:'0500000001'}));
  assert.equal(response.status,503);const data=await response.json();assert.equal(data.code,'OTP_DISPATCH_FAILED');assert.ok(!JSON.stringify(data).includes('654321'));
});
