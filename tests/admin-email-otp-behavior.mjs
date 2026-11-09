import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";

async function loadHandler(name, bindings) {
 let source=await readFile(new URL("../netlify/functions/"+name+".mts",import.meta.url),"utf8");
 source=source.replace(/^import .*;\s*$/gm,"");
 const prefix=Object.keys(bindings).map(key=>"const "+key+"=globalThis.__emailBindings."+key+";").join("\n");
 globalThis.__emailBindings=bindings;
 const code=ts.transpileModule(prefix+"\n"+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return (await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64")+"#"+crypto.randomUUID())).default;
}
const secureJson=(data,status=200)=>Response.json(data,{status});
const isSameOriginRequest=()=>true;
const req=(path,body)=>new Request("https://preview.example"+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});

test("email OTP issuance binds to approved admin and revokes earlier codes",async()=>{
 const env={HALA_ADMIN_EMAILS:"shinko77@gmail.com",RESEND_API_KEY:"fake-key",HALA_AUTH_EMAIL_FROM:"HALA <login@example.test>"};
 globalThis.Netlify={env:{get:key=>env[key]}};
 const queries=[];
 const client={query:async(sql,args=[])=>{
  queries.push({sql,args});
  if(sql.startsWith("SELECT sent_at"))return {rows:[]};
  if(sql.includes("COUNT(*)"))return {rows:[{n:0}]};
  return {rows:[]};
 },release(){}};
 const db={
  sql:async(parts,...args)=>{assert.match(parts.join("?"),/SELECT id FROM users/);assert.equal(args[0],"shinko77@gmail.com");return [{id:"director-1"}];},
  pool:{connect:async()=>client}
 };
 const saved=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({id:"sent"});
 try{
  const issue=await loadHandler("auth-admin-email-request",{
   getDatabase:()=>db,isSameOriginRequest,secureJson,
   normalizeEmail:s=>s.trim().toLowerCase(),validEmail:()=>true,emailHash:async()=>"hashed",
   allowedEmail:e=>e==="shinko77@gmail.com"
  });
  const response=await issue(req("/api/auth/admin-email/request",{email:"shinko77@gmail.com"}));
  assert.equal(response.status,200);
  const revoke=queries.find(x=>x.sql.startsWith("UPDATE admin_email_otp_codes SET consumed_at"));
  assert.deepEqual(revoke?.args,["shinko77@gmail.com"]);
  const insert=queries.find(x=>x.sql.startsWith("INSERT INTO admin_email_otp_codes"));
  assert.ok(insert);
  assert.equal(insert.args[1],"director-1");
 }finally{globalThis.fetch=saved}
});

test("email OTP cannot mint admin session for another account",async()=>{
 globalThis.Netlify={env:{get:()=>undefined}};
 let sessions=0;
 const db={sql:async(parts,...args)=>{
  const sql=parts.join("?");
  if(sql.includes("SELECT * FROM admin_email_otp_codes"))return [{id:"otp-1",user_id:"director-1",code_hash:"good"}];
  if(sql.includes("SET attempts=attempts+1"))return [{id:"otp-1"}];
  if(sql.includes("SET consumed_at=NOW()"))return [{id:"otp-1"}];
  if(sql.includes("FROM users WHERE id=")){assert.equal(args[0],"director-1");return []}
  throw Error("Unexpected SQL: "+sql);
 }};
 const verify=await loadHandler("auth-admin-email-verify",{
  getDatabase:()=>db,createSession:async()=>{sessions++;return {token:"bad"}},
  publicUser:u=>u,recordAudit:async()=>{},isSameOriginRequest,normalizeDigits:s=>s,secureJson,
  normalizeEmail:s=>s,validEmail:()=>true,emailHash:async()=>"good",allowedEmail:()=>true
 });
 const response=await verify(req("/api/auth/admin-email/verify",{email:"shinko77@gmail.com",code:"123456"}));
 assert.equal(response.status,403);
 assert.equal(sessions,0);
});

test("parallel admin email OTP guesses limit verification to five attempts",async()=>{
 globalThis.Netlify={env:{get:()=>undefined}};
 let tries=0,hashed=0;
 const db={sql:async parts=>{
  const sql=parts.join("?");
  if(sql.includes("SELECT * FROM admin_email_otp_codes"))return [{id:"otp-1",user_id:"director-1",code_hash:"good"}];
  if(sql.includes("SET attempts=attempts+1"))return tries++<5?[{id:"otp-1"}]:[];
  throw Error("Unexpected SQL: "+sql);
 }};
 const verify=await loadHandler("auth-admin-email-verify",{
  getDatabase:()=>db,createSession:async()=>{throw Error("No session")},
  publicUser:u=>u,recordAudit:async()=>{},isSameOriginRequest,normalizeDigits:s=>s,secureJson,
  normalizeEmail:s=>s,validEmail:()=>true,emailHash:async()=>{hashed++;return "wrong"},allowedEmail:()=>true
 });
 const responses=await Promise.all(Array.from({length:20},()=>verify(req("/api/auth/admin-email/verify",{email:"shinko77@gmail.com",code:"000000"}))));
 assert.equal(responses.filter(r=>r.status===401).length,5);
 assert.equal(responses.filter(r=>r.status===429).length,15);
 assert.equal(hashed,5);
});
