import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import ts from 'typescript';
import { packageFor, publicPackages } from '../netlify/functions/_shared/payments.mjs';
import { normalizeDigits, normalizePhone } from '../netlify/functions/_shared/domain.mjs';
import { normalizeReferralCode, referralAmounts } from '../netlify/functions/_shared/partners.mjs';

async function handler(name, bindings) {
  bindings={normalizeDigits,...bindings};
  let source = await readFile(new URL(`../netlify/functions/${name}.mts`, import.meta.url), 'utf8');
  source = source.replace(/^import .*;\s*$/gm, '');
  const prefix = Object.entries(bindings).map(([key, value]) => `const ${key}=globalThis.__testBindings.${key};`).join('\n');
  globalThis.__testBindings = bindings;
  const code = ts.transpileModule(prefix+'\n'+source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${crypto.randomUUID()}`)).default;
}
globalThis.__testNormalizeDigits=normalizeDigits;
const secureJson = (body, status=200) => Response.json(body, {status});
const isSameOriginRequest = () => true;
const request = (path, body) => new Request(`https://preview.example${path}`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});

test('OTP routes the two configured admin numbers, creates customer accounts, and rejects replay', async () => {
  const env={HALA_ADMIN_PHONES:'966501112234,966501112235'};
  globalThis.Netlify={env:{get:key=>env[key]}};
  let currentPhone='', consumed=false, sessionUser='', wrongAttempts=0;
  const db={sql:async(parts,...args)=>{
    const sql=parts.join('?');
    if(sql.includes('SELECT * FROM otp_codes')){currentPhone=args[0];return consumed?[]:[{id:'otp',code_hash:'good',attempts:0}];}
    if(sql.includes('SET attempts=')){wrongAttempts++;return [{id:'otp'}];}
    if(sql.includes('SET consumed_at=')){if(consumed)return [];consumed=true;return [{id:'otp'}];}
    if(sql.includes('FROM users WHERE phone='))return [];
    if(sql.includes('DELETE FROM sessions'))return [];
    if(sql.includes('INSERT INTO users'))return [{id:'user',phone:args[2],name:args[1],role:args[3],status:'active'}];
    throw Error(`Unexpected SQL: ${sql}`);
  }};
  const verify=await handler('auth-otp-verify', {
    getDatabase:()=>db, createSession:async id=>{sessionUser=id;return {token:'test-session'};},
    publicUser:u=>u, recordAudit:async()=>{}, isSameOriginRequest, normalizePhone:p=>p, secureJson,
    hashOtp:async(_phone,code)=>code==='123456'?'good':'bad', normalizeLoginPhone:p=>p
  });
  for(const phone of ['966501112234','966501112235','966501112233']){
    consumed=false;
    const res=await verify(request('/api/auth/otp/verify',{phone,code:'123456'}));
    assert.equal(res.status,200);assert.equal((await res.json()).user.role,env.HALA_ADMIN_PHONES.includes(phone)?'admin':'customer');
    assert.equal(sessionUser,'user');
    assert.equal((await verify(request('/api/auth/otp/verify',{phone,code:'123456'}))).status,400);
  }
  consumed=false;
  assert.equal((await verify(request('/api/auth/otp/verify',{phone:'966501112233',code:'000000'}))).status,401);
  assert.equal(wrongAttempts,4);
});

test('payment order uses server price plus 299 SAR supervisor addon and owner authorization',async()=>{
  globalThis.Netlify={env:{get:()=>undefined}};
  let owner=true, addon=29900, inserted=[];
  const db={sql:async(parts,...args)=>{
    const sql=parts.join('?');
    if(sql.includes('FROM event_members'))return owner?[{exists:true}]:[];
    if(sql.includes('FROM guests'))return [{count:12}];
    if(sql.includes("status='paid'"))return [];
    if(sql.includes('FROM supervisor_requests'))return [{status:'requested'}];
    if(sql.includes('SELECT referral_code FROM events'))return [{referral_code:null}];
    if(sql.includes('UPDATE supervisor_requests'))return [];
    if(sql.includes("status='pending'"))return [];
    if(sql.includes('INSERT INTO payment_orders')){inserted=args;return [{id:args[0],amount:args[4],supervisor_addon_amount:args[5],status:'pending'}];}
    throw Error(`Unexpected SQL: ${sql}`);
  }};
  const order=await handler('payment-order', {
    getDatabase:()=>db, canAccessEvent:async()=>true, requireRole:async()=>({ok:true,user:{id:'customer',role:'customer'}}),
    isSameOriginRequest, secureJson, moyasarFeatures:()=>({configured:true,publishableKey:'pk_test',applePay:{enabled:false},stcPay:{enabled:false}}),
    packageFor,publicPackages,supervisorAddonHalalas:async()=>addon,normalizeReferralCode,
    activePartner:async()=>null,referralAmounts
  });
  let res=await order(request('/api/payments/order',{eventId:'event',packageCode:'hala_plus',amount:1}));
  assert.equal(res.status,201);assert.equal((await res.json()).order.amount,64800);
  assert.equal(inserted[5],29900);
  owner=false;res=await order(request('/api/payments/order',{eventId:'event',packageCode:'hala_plus'}));assert.equal(res.status,403);
});

test('admin overview guards metrics and reports payment revenue once',async()=>{
  let authorized=false;
  const overview=await handler('admin-overview',{
    getDatabase:()=>({sql:async parts=>{
      const sql=parts.join('');
      if(sql.includes('SUM(amount)'))return [{revenue:39800,paid:1}];
      if(sql.includes('FROM whatsapp_messages'))return [{total:4,sent:1,delivered:1,read:1,failed:1}];
      if(sql.includes('FROM supervisor_requests'))return [{total:1,requested:1,assigned:0,completed:0}];
      if(sql.includes('FROM audit_log')||sql.includes('LIMIT 12'))return [];
      return [{count:2}];
    }}),requireRole:async()=>authorized?{ok:true,user:{role:'admin'}}:{ok:false,status:403,error:'forbidden'},secureJson
  });
  const req=new Request('https://preview.example/api/admin/overview');
  assert.equal((await overview(req)).status,403);
  authorized=true;
  const res=await overview(req),body=await res.json();
  assert.equal(res.status,200);assert.equal(body.stats.revenueHalalas,39800);
  assert.equal(body.stats.declined,2);assert.equal(body.stats.pendingRsvp,2);
  assert.equal(body.stats.whatsapp.failed,1);assert.equal(body.stats.supervisorRequests.requested,1);
});

test('supervisor assignment requires a paid request and active supervisor',async()=>{
  let paid=false,active=true,linked=[];
  const assign=await handler('admin-supervisors',{
    getDatabase:()=>({sql:async(parts,...args)=>{
      const sql=parts.join('?');
      if(sql.includes("role='supervisor' AND status='active'"))return active?[{id:args[0]}]:[];
      if(sql.includes('UPDATE supervisor_requests'))return paid?[{id:'request',event_id:'event'}]:[];
      throw Error(`Unexpected SQL: ${sql}`);
    }}),requireRole:async()=>({ok:true,user:{id:'admin',role:'admin'}}),isSameOriginRequest,secureJson,
    linkEventMember:async(...args)=>linked.push(args),recordAudit:async()=>{}
  });
  const req=()=>request('/api/admin/supervisors',{requestId:'request',supervisorId:'supervisor'});
  assert.equal((await assign(req())).status,409);assert.equal(linked.length,0);
  paid=true;active=false;assert.equal((await assign(req())).status,404);
  active=true;assert.equal((await assign(req())).status,200);
  assert.deepEqual(linked,[['event','supervisor','supervisor']]);
});

test('temporary admin bootstrap endpoint is absent from deployment sources',async()=>{
  await assert.rejects(stat(new URL('../netlify/functions/auth-bootstrap-admin.mts',import.meta.url)),{code:'ENOENT'});
});

test('parallel OTP guesses cannot exceed the five reserved attempts',async()=>{
  let attempts=0,hashed=0;
  const db={sql:async(parts)=>{
    const sql=parts.join('?');
    if(sql.includes('SELECT * FROM otp_codes'))return [{id:'otp',code_hash:'correct-hash',attempts:0}];
    if(sql.includes('SET attempts='))return attempts++<5?[{id:'otp'}]:[];
    throw Error(`Unexpected SQL: ${sql}`);
  }};
  const verify=await handler('auth-otp-verify',{
    getDatabase:()=>db,createSession:async()=>{throw Error('No session for wrong code');},publicUser:u=>u,recordAudit:async()=>{},
    isSameOriginRequest,normalizePhone:p=>p,secureJson,normalizeLoginPhone:p=>p,
    hashOtp:async()=>{hashed++;await Promise.resolve();return 'wrong-hash';}
  });
  const responses=await Promise.all(Array.from({length:20},()=>verify(request('/api/auth/otp/verify',{phone:'966501112233',code:'000000'}))));
  assert.equal(responses.filter(r=>r.status===401).length,5);
  assert.equal(responses.filter(r=>r.status===429).length,15);
  assert.equal(hashed,5);
});

test('legacy password registration and login cannot claim a phone identity or issue sessions',async()=>{
  for(const endpoint of ['auth-register','auth-login']){
    const legacy=await handler(endpoint,{secureJson});
    const response=await legacy(request('/api/auth/register',{name:'Attacker',email:'synthetic@example.test',phone:'966501112234',password:'not-a-real-password'}));
    assert.equal(response.status,410);
    assert.equal((await response.json()).code,'PHONE_OTP_REQUIRED');
  }
});

test('admin OTP retires preexisting sessions and password credentials before issuing new session',async()=>{
  globalThis.Netlify={env:{get:key=>key==='HALA_ADMIN_PHONES'?'966501112234':undefined}};
  const calls=[];
  const db={sql:async(parts)=>{
    const sql=parts.join('?');calls.push(sql);
    if(sql.includes('SELECT * FROM otp_codes'))return [{id:'otp',code_hash:'hash',attempts:0}];
    if(sql.includes('SET attempts=')||sql.includes('SET consumed_at='))return [{id:'otp'}];
    if(sql.includes('FROM users WHERE phone='))return [{id:'preclaimed',role:'customer',status:'active'}];
    if(sql.includes('UPDATE users'))return [{id:'preclaimed',role:'admin',status:'active'}];
    if(sql.includes('DELETE FROM sessions'))return [];
    throw Error(`Unexpected SQL: ${sql}`);
  }};
  const verify=await handler('auth-otp-verify',{
    getDatabase:()=>db,createSession:async()=>{calls.push('NEW_SESSION');return {token:'synthetic'};},publicUser:u=>u,recordAudit:async()=>{},
    isSameOriginRequest,normalizePhone:p=>p,secureJson,normalizeLoginPhone:p=>p,hashOtp:async()=>'hash'
  });
  assert.equal((await verify(request('/api/auth/otp/verify',{phone:'966501112234',code:'123456'}))).status,200);
  assert.ok(calls.find(sql=>sql.includes('UPDATE users')).includes('password_hash=NULL,password_salt=NULL'));
  assert.ok(calls.findIndex(sql=>sql.includes('DELETE FROM sessions'))<calls.indexOf('NEW_SESSION'));
});

test('simultaneous OTP requests share one phone cooldown reservation',async()=>{
  let source=await readFile(new URL('../netlify/functions/_shared/otp.mjs',import.meta.url),'utf8');
  source=source.replace('import { getDatabase } from "@netlify/database";', 'const getDatabase=()=>globalThis.__otpIssueDb;');
  for(const part of ['domain','whatsapp','auth'])source=source.replace(`"./${part}.mjs"`,JSON.stringify(new URL(`../netlify/functions/_shared/${part}.mjs`,import.meta.url).href));
  globalThis.Netlify={env:{get:key=>key==='HALA_OTP_SECRET'?'synthetic-secret-with-more-than-24-characters':undefined}};
  let lock=Promise.resolve(),sentAt=null,inserts=0;
  globalThis.__otpIssueDb={pool:{connect:async()=>{
    let unlock;
    return {query:async(sql)=>{
      if(sql.includes('pg_advisory_xact_lock')){
        const prior=lock;lock=new Promise(resolve=>{unlock=resolve;});await prior;
      }
      if(sql.startsWith('SELECT sent_at'))return {rows:sentAt?[{sent_at:sentAt}]:[]};
      if(sql.includes('COUNT(*)'))return {rows:[{count:inserts}]};
      if(sql.startsWith('INSERT')){inserts++;sentAt=new Date().toISOString();}
      if(sql==='COMMIT'||sql==='ROLLBACK'){unlock?.();unlock=null;}
      return {rows:[]};
    },release:()=>unlock?.()};
  }}};
  const {issueOtp}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${crypto.randomUUID()}`);
  const results=await Promise.all(Array.from({length:12},()=>issueOtp('966501112233')));
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(results.filter(r=>r.status===429).length,11);
  assert.equal(inserts,1);
});
