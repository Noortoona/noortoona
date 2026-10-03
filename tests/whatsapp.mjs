import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { providerConfig, nextStatus, extractStatuses } from '../netlify/functions/_shared/whatsapp.mjs';

// Execute real handlers with isolated provider/SQL doubles: never sends a live message.
async function handler(file) {
  let source = await readFile(new URL('../netlify/functions/'+file, import.meta.url), 'utf8');
  source=source.replace('import { getDatabase } from "@netlify/database";','const getDatabase = () => globalThis.__waDb;');
  source=source.replace('import { canAccessEvent, getAuth, recordAudit } from "./_shared/auth.mjs";','const getAuth=async()=>null; const canAccessEvent=async()=>false; const recordAudit=async()=>{};');
  for (const part of ['domain','whatsapp']) source=source.replace(`"./_shared/${part}.mjs"`, JSON.stringify(new URL(`../netlify/functions/_shared/${part}.mjs`,import.meta.url).href));
  return (await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'))).default;
}
const send=await handler('whatsapp-send.mts'), webhook=await handler('whatsapp-webhook.mts'), setup=await handler('whatsapp-setup.mts');
let calls, fetches, env, previous, providerReply, providerThrows, storedStatus, missingMessage, dbFails;
function reset() {
  calls=[];fetches=[];previous=[];providerThrows=false;storedStatus='queued';missingMessage=false;dbFails=false;
  env={D360_MODE:'production',D360_API_KEY:'test-only-key',D360_WEBHOOK_TOKEN:'test-only-token',D360_INVITE_TEMPLATE:'hala_invite',D360_REMINDER_TEMPLATE:'hala_reminder',D360_TEMPLATE_LANGUAGE:'ar'};
  globalThis.Netlify={env:{get:key=>env[key]}};
  providerReply={status:200,body:{messages:[{id:'wamid.test'}]}};
  globalThis.fetch=async(url,options)=>{fetches.push({url,body:JSON.parse(options.body)});if(providerThrows)throw new Error('timeout');return Response.json(providerReply.body,{status:providerReply.status});};
  globalThis.__waDb={
    sql:async(parts,...args)=>{
      const sql=parts.join('?');calls.push({sql,args});
      if(sql.includes('SELECT g.*'))return [{id:'guest',phone:'0500000000',name:'ضيف الاختبار',code:'INVITE',title:'اختبار هلا',location:'الرياض'}];
      return [];
    },
    pool:{connect:async()=>({
      query:async(sql,args=[])=>{
        calls.push({sql,args});if(dbFails&&sql.includes('UPDATE whatsapp_messages'))throw new Error('database unavailable');
        if(sql.includes('SELECT id, message_id, status'))return {rows:previous};
        if(sql.includes('INSERT INTO whatsapp_messages'))return {rows:[{id:17}]};
        if(sql.includes('SELECT id, guest_id'))return {rows:missingMessage?[]:[{id:17,guest_id:'guest'}]};
        if(sql.includes('SELECT status FROM'))return {rows:[{status:storedStatus}]};
        return {rows:[]};
      },release:()=>{}
    })}
  };
}
const request=()=>new Request('https://preview.example/api/whatsapp/send',{method:'POST',headers:{'content-type':'application/json','x-noortoona-owner-token':'test-owner',origin:'https://preview.example'},body:JSON.stringify({eventId:'event',guestId:'guest'})});
const callback=(status='delivered',auth=true)=>new Request('https://preview.example/api/whatsapp/webhook',{method:'POST',headers:auth?{authorization:'Bearer test-only-token'}:{},body:JSON.stringify({statuses:[{id:'wamid.test',status,timestamp:'1790895600',errors:status==='failed'?[{code:131026,title:'Message undeliverable'}]:undefined}]})});

test('configuration is explicit and prevents cross-environment key routing',()=>{
 assert.throws(()=>providerConfig(()=>undefined),/D360_MODE_REQUIRED/);
 assert.throws(()=>providerConfig(k=>({D360_MODE:'production',D360_API_BASE:'https://example.com',D360_API_KEY:'x'})[k]),/D360_API_BASE_MISMATCH/);
});
test('API acceptance with message_id is queued, never sent or delivered',async()=>{
 reset();const res=await send(request()),data=await res.json();
 assert.equal(res.status,202);assert.equal(data.status,'queued');assert.equal(data.deliveryConfirmed,false);assert.equal(data.messageId,'wamid.test');
 assert.equal(fetches[0].url,'https://waba-v2.360dialog.io/messages');
 assert.equal(fetches[0].body.template.components[0].parameters[4].text,'https://preview.example/i/INVITE');
 assert.ok(!calls.some(c=>/SET.*status='sent'/.test(c.sql)));
});
test('provider failure returns the real error code without payload leakage',async()=>{
 reset();providerReply={status:400,body:{error:{code:131026,message:'Message undeliverable'},secret:'not-for-browser'}};
 const res=await send(request()),data=await res.json();assert.equal(res.status,502);assert.equal(data.providerCode,'131026');assert.equal(data.secret,undefined);
 assert.ok(calls.some(c=>c.sql.includes("whatsapp_status='failed'")));
});
test('missing message_id never becomes a success',async()=>{
 reset();providerReply.body={success:true};const res=await send(request());assert.equal(res.status,502);assert.equal((await res.json()).code,'D360_MESSAGE_ID_MISSING');
});
test('timeout remains uncertain and is not silently retried',async()=>{
 reset();providerThrows=true;const res=await send(request());assert.equal(res.status,504);assert.equal((await res.json()).status,'queued');assert.equal(fetches.length,1);
});
test('duplicate request is blocked before sending',async()=>{
 reset();previous=[{status:'queued',message_id:'wamid.test'}];assert.equal((await send(request())).status,409);assert.equal(fetches.length,0);
});
test('missing mode, template, or webhook protection blocks live send',async()=>{
 for(const key of ['D360_MODE','D360_INVITE_TEMPLATE','D360_WEBHOOK_TOKEN']){
  reset();delete env[key];assert.ok((await send(request())).status>=400);assert.equal(fetches.length,0);
 }
});
test('unauthenticated callback cannot claim delivery',async()=>{
 reset();assert.equal((await webhook(callback('delivered',false))).status,401);assert.equal(calls.length,0);
});
test('verified delivery writes log and matching guest atomically',async()=>{
 reset();assert.equal((await webhook(callback())).status,200);
 const updates=calls.filter(c=>c.sql.startsWith('UPDATE'));assert.equal(updates.length,2);assert.equal(updates[0].args[0],'delivered');
 assert.ok(updates[1].sql.includes('whatsapp_message_id=$5'));assert.equal(calls.at(-1).sql,'COMMIT');
});
test('failure webhook preserves provider reason for host',async()=>{
 reset();assert.equal((await webhook(callback('failed'))).status,200);
 const update=calls.find(c=>c.sql.startsWith('UPDATE whatsapp_messages'));assert.equal(JSON.parse(update.args[1]).code,'131026');
});
test('delayed and duplicate callbacks never downgrade delivered/read',async()=>{
 reset();storedStatus='read';assert.equal((await webhook(callback('sent'))).status,200);assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,0);
 for(const incoming of ['sent','delivered','read','failed'])assert.equal(nextStatus('read',incoming),'read');
 assert.equal(nextStatus('delivered','sent'),'delivered');
});
test('early callback and database failure request retry instead of losing delivery',async()=>{
 reset();missingMessage=true;assert.equal((await webhook(callback())).status,503);
 reset();dbFails=true;assert.equal((await webhook(callback())).status,503);assert.equal(calls.at(-1).sql,'ROLLBACK');
});
test('nested Meta statuses are parsed',()=>{
 assert.deepEqual(extractStatuses({entry:[{changes:[{value:{statuses:[{id:'wamid.x',status:'read'}]}}]}]}),[{id:'wamid.x',status:'read'}]);
});
test('setup is protected in sandbox too and GET does not mutate provider',async()=>{
 reset();env.D360_MODE='sandbox';
 assert.equal((await setup(new Request('https://preview.example/api/whatsapp/setup'))).status,403);assert.equal(fetches.length,0);
 env.D360_SETUP_TOKEN='setup-test';
 const res=await setup(new Request('https://preview.example/api/whatsapp/setup',{headers:{'x-noortoona-setup-token':'setup-test'}}));
 assert.equal(res.status,200);assert.equal(fetches.length,0);assert.equal((await res.json()).providerRegistrationVerified,false);
});
