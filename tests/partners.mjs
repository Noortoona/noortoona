import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { normalizeReferralCode, referralAmounts, recordAcquisition } from '../netlify/functions/_shared/partners.mjs';
import { packageFor, publicPackages } from '../netlify/functions/_shared/payments.mjs';

async function handler(name, bindings) {
  let source = await readFile(new URL(`../netlify/functions/${name}.mts`, import.meta.url), 'utf8');
  source = source.replace(/^import .*;\s*$/gm, '');
  const globals = Object.entries(bindings).map(([key, value]) => `const ${key}=globalThis.__partnerTest.${key};`).join('\n');
  globalThis.__partnerTest = bindings;
  const code = ts.transpileModule(globals+'\n'+source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
}
const secureJson = (body,status=200) => Response.json(body,{status});
const request = body => new Request('https://preview.example/api/payments/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('venue and influencer rates apply only to base package, never supervisor', () => {
  assert.equal(normalizeReferralCode('  hala_10  '),'HALA_10');
  assert.equal(normalizeReferralCode('<bad>'),'');
  assert.deepEqual(referralAmounts(9900,29900,{kind:'venue',commission_bps:1000,discount_bps:0}),{discountAmount:0,commissionAmount:990,total:39800});
  assert.deepEqual(referralAmounts(9900,29900,{kind:'influencer',commission_bps:1000,discount_bps:1000}),{discountAmount:990,commissionAmount:891,total:38810});
  assert.throws(()=>referralAmounts(9900,0,{kind:'influencer',discount_bps:10001,commission_bps:1000}),/INVALID_PARTNER_RATE/);
});

test('checkout ignores client prices, validates a code, and snapshots the discounted payment', async () => {
  globalThis.Netlify={env:{get:()=>undefined}};
  const inserts=[];
  const db={sql:async(parts,...args)=>{
    const sql=parts.join('?');
    if(sql.includes('FROM event_members'))return [{yes:1}];
    if(sql.includes('FROM guests'))return [{count:2}];
    if(sql.includes("status='paid'"))return [];
    if(sql.includes('FROM supervisor_requests'))return [{status:'requested'}];
    if(sql.includes('SELECT referral_code FROM events'))return [{referral_code:null}];
    if(sql.includes('UPDATE supervisor_requests'))return [];
    if(sql.includes("status='pending'"))return [];
    if(sql.includes('INSERT INTO payment_orders')){inserts.push(args);return [{id:args[0],amount:args[4],discount_amount:args[9],status:'pending'}];}
    throw new Error(sql);
  }};
  const order=await handler('payment-order',{
    getDatabase:()=>db,canAccessEvent:async()=>true,requireRole:async()=>({ok:true,user:{id:'buyer',role:'customer'}}),
    isSameOriginRequest:()=>true,secureJson,moyasarFeatures:()=>({configured:true,publishableKey:'pk_test',applePay:{enabled:false},stcPay:{enabled:false}}),
    packageFor,publicPackages,supervisorAddonHalalas:async()=>29900,normalizeReferralCode,referralAmounts,
    activePartner:async(_db,code)=>code==='STAR10'?{code,user_id:'star',kind:'influencer',discount_bps:1000,commission_bps:1000}:null
  });
  const invalid=await order(request({eventId:'event',packageCode:'basic',referralCode:'invalid'}));
  assert.equal(invalid.status,400);
  const res=await order(request({eventId:'event',packageCode:'basic',referralCode:'star10',amount:1,commissionAmount:1}));
  assert.equal(res.status,201);
  assert.equal((await res.json()).order.amount,38810);
  assert.equal(inserts[0][7],'STAR10');assert.equal(inserts[0][8],'star');
  assert.equal(inserts[0][9],990);assert.equal(inserts[0][10],891);
});

test('first paid acquisition records one commission, retries and later orders do not duplicate it',async()=>{
  let acquisition=null, commissions=0, recorded=false;
  const db={sql:async(parts,...args)=>{
    const sql=parts.join('?');
    if(sql.includes('INSERT INTO customer_acquisitions')){if(acquisition)return [];acquisition={first_order_id:args[1],partner_user_id:args[2]};return [acquisition];}
    if(sql.includes('SELECT first_order_id'))return [acquisition];
    if(sql.includes('INSERT INTO partner_commissions')){if(!recorded){commissions++;recorded=true;}return [];}
    throw Error(sql);
  }};
  const first={id:'order1',user_id:'buyer',referral_partner_id:'star',commission_amount:891};
  await recordAcquisition(db,first);
  await recordAcquisition(db,first);
  await recordAcquisition(db,{...first,id:'order2'});
  assert.equal(acquisition.first_order_id,'order1');
  assert.equal(commissions,1,'database unique constraint makes webhook retry idempotent');
});

test('partner portal rejects customer role',async()=>{
  const endpoint=await handler('partner-home',{requireRole:async()=>({ok:false,status:403,error:'forbidden'}),secureJson,getDatabase:()=>{throw Error('database must not be touched')}});
  assert.equal((await endpoint(new Request('https://preview.example/api/partner/home'))).status,403);
});
