import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {normalizeEmail,validEmail,allowedEmail,emailHash} from "../netlify/functions/_shared/admin-email-otp.mjs";

test("admin email allowlist never approves an unconfigured or different email",async()=>{
 globalThis.Netlify={env:{get:key=>key==="HALA_ADMIN_EMAILS"?"shinko77@gmail.com":undefined}};
 assert.equal(allowedEmail("shinko77@gmail.com"),true);
 assert.equal(allowedEmail("other@gmail.com"),false);
 assert.equal(validEmail(normalizeEmail(" Shinko77@Gmail.com ")),true);
 assert.equal(validEmail("not-an-email"),false);
});

test("admin OTP hashes are purpose-bound and require secret",async()=>{
 globalThis.Netlify={env:{get:key=>key==="HALA_OTP_SECRET"?"test-secret-at-least-24-characters-long":undefined}};
 const a=await emailHash("shinko77@gmail.com","123456");
 const b=await emailHash("shinko77@gmail.com","654321");
 assert.notEqual(a,b);
 assert.match(a,/^[a-f0-9]{64}$/);
 globalThis.Netlify={env:{get:()=>undefined}};
 await assert.rejects(emailHash("shinko77@gmail.com","123456"),/OTP_SECRET_REQUIRED/);
});

test("email routes require preexisting active privileged user and never create or promote accounts",async()=>{
 const request=await readFile(new URL("../netlify/functions/auth-admin-email-request.mts",import.meta.url),"utf8");
 const verify=await readFile(new URL("../netlify/functions/auth-admin-email-verify.mts",import.meta.url),"utf8");
 for(const source of [request,verify]){
  assert.match(source,/role IN \('admin','customer_service'\)/);
  assert.match(source,/status='active'/);
  assert.doesNotMatch(source,/INSERT INTO users|UPDATE users SET role/);
  assert.match(source,/allowedEmail\(email\)/);
 }
 assert.match(verify,/attempts=attempts\+1/);
 assert.match(verify,/consumed_at=NOW\(\)/);
 assert.match(request,/INTERVAL '5 minutes'/);
 assert.match(request,/RESEND_API_KEY/);
});

test("admin route defaults to email while customer remains on phone",async()=>{
 const ui=await readFile(new URL("../account.js",import.meta.url),"utf8");
 assert.match(ui,/purpose==="admin"\?"email":"phone"/);
 assert.match(ui,/\/api\/auth\/admin-email\/request/);
 assert.match(ui,/\/api\/auth\/admin-email\/verify/);
 assert.match(ui,/\/api\/auth\/otp\/request/);
});
