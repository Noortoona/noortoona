import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { packageFor, publicPackages } from '../netlify/functions/_shared/payments.mjs';

async function handler(name, bindings) {
  let source = await readFile(new URL(`../netlify/functions/${name}.mts`, import.meta.url), 'utf8');
  source = source.replace(/^import .*;\s*$/gm, '');
  const prefix = Object.entries(bindings).map(([key, value]) => `const ${key}=globalThis.__testBindings.${key};`).join('\n');
  globalThis.__testBindings = bindings;
  const code = ts.transpileModule(prefix+'\n'+source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
}
const secureJson = (body, status=200) => Response.json(body, {status});
const isSameOriginRequest = () => true;
const request = (path, body) => new Request(`https://preview.example${path}`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});

test('OTP routes the two configured admin numbers, creates customer accounts, and rejects replay', async () => {
  const env={HALA_ADMIN_PHONES:'966559390073,966563133109'};
  globalThis.Netlify={env:{get:key=>env[key]}};
  let currentPhone='', consumed=false, sessionUser='', wrongAttempts=0;
  const db={sql:async(parts,...args)=>{
    const sql=parts.join('?');
    if(sql.includes('SELECT * FROM otp_codes')){currentPhone=args[0];return consumed?[]:[{id:'otp',code_hash:'good',attempts:0}];}
    if(sql.includes('SET attempts=')){wrongAttempts++;return [];}
    if(sql.includes('SET consumed_at=')){if(consumed)return [];consumed=true;return [{id:'otp'}];}
    if(sql.includes('FROM users WHERE phone='))return [];
    if(sql.includes('INSERT INTO users'))return [{id:'user',phone:args[2],name:args[1],role:args[3],status:'active'}];
    throw Error(`Unexpected SQL: ${sql}`);
  }};
  const verify=await handler('auth-otp-verify', {
    getDatabase:()=>db, createSession:async id=>{sessionUser=id;return {token:'test-session'};},
    publicUser:u=>u, recordAudit:async()=>{}, isSameOriginRequest, normalizePhone:p=>p, secureJson,
    hashOtp:async(_phone,code)=>code==='123456'?'good':'bad', normalizeLoginPhone:p=>p
  });
  for(const phone of ['966559390073','966563133109','966501112233']){
    consumed=false;
    const res=await verify(request('/api/auth/otp/verify',{phone,code:'123456'}));
    assert.equal(res.status,200);assert.equal((await res.json()).user.role,env.HALA_ADMIN_PHONES.includes(phone)?'admin':'customer');
    assert.equal(sessionUser,'user');
    assert.equal((await verify(request('/api/auth/otp/verify',{phone,code:'123456'}))).status,400);
  }
  consumed=false;
  assert.equal((await verify(request('/api/auth/otp/verify',{phone:'966501112233',code:'000000'}))).status,401);
  assert.equal(wrongAttempts,1);
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
    if(sql.includes('UPDATE supervisor_requests'))return [];
    if(sql.includes("status='pending'"))return [];
    if(sql.includes('INSERT INTO payment_orders')){inserted=args;return [{id:args[0],amount:args[4],supervisor_addon_amount:args[5],status:'pending'}];}
    throw Error(`Unexpected SQL: ${sql}`);
  }};
  const order=await handler('payment-order', {
    getDatabase:()=>db, canAccessEvent:async()=>true, requireRole:async()=>({ok:true,user:{id:'customer',role:'customer'}}),
    isSameOriginRequest, secureJson, moyasarFeatures:()=>({configured:true,publishableKey:'pk_test',applePay:{enabled:false},stcPay:{enabled:false}}),
    packageFor,publicPackages,supervisorAddonHalalas:async()=>addon
  });
  let res=await order(request('/api/payments/order',{eventId:'event',packageCode:'basic',amount:1}));
  assert.equal(res.status,201);assert.equal((await res.json()).order.amount,39800);
  assert.equal(inserted[5],29900);
  owner=false;res=await order(request('/api/payments/order',{eventId:'event',packageCode:'basic'}));assert.equal(res.status,403);
});
