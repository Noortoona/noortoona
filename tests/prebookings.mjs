import test from "node:test";
import assert from "node:assert/strict";
import { readdir,readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { PGlite } from "@electric-sql/pglite";

registerHooks({resolve(specifier,context,next){
  if(specifier==="@netlify/database")return {url:"data:text/javascript,export function getDatabase(){return globalThis.__HALA_DB__}",shortCircuit:true};
  return next(specifier,context);
}});
const postgres=new PGlite();
let chain=Promise.resolve();
async function lock(){const old=chain;let unlock;chain=new Promise(done=>unlock=done);await old;return unlock}
const db={
  sql:async(parts,...values)=>{const unlock=await lock();try{return (await postgres.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values)).rows}finally{unlock()}},
  pool:{connect:async()=>{const unlock=await lock();return {query:(sql,args)=>postgres.query(sql,args),release:unlock}}},
};
globalThis.__HALA_DB__=db;
globalThis.Netlify={env:{get:()=>undefined}};
const {createSession}=await import("../netlify/functions/_shared/auth.mjs");
const createEvent=(await import("../netlify/functions/create-event.mts")).default;
const adminBookings=(await import("../netlify/functions/admin-bookings.mts")).default;
const {notificationChannelReady}=await import("../netlify/functions/_shared/booking-notify.mjs");
function request(path,body,token="",method="POST"){
  return new Request("https://preview.example"+path,{
    method,headers:{origin:"https://preview.example","content-type":"application/json",...(token?{authorization:"Bearer "+token}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
}
await test("real prebookings create a durable pending record and notifications",async t=>{
  t.after(()=>postgres.close());
  const root=new URL("../netlify/database/migrations/",import.meta.url);
  for(const name of (await readdir(root)).sort()){
    await postgres.exec(await readFile(new URL(name+"/migration.sql",root),"utf8"));
  }
  await postgres.exec(`
    INSERT INTO users(id,name,phone,role) VALUES
      ('prebook-customer','عميل حقيقي','966501234567','customer'),
      ('prebook-admin','مدير هلا','966501234568','admin');
  `);
  const customer=await createSession("prebook-customer");
  const admin=await createSession("prebook-admin");
  const result=await createEvent(request("/api/events",{
    title:"مناسبة اختبار حقيقية في بيئة معزولة",name1:"العميل",occasion:"زواج",package:"هلا بلس",
    date:"2027-01-01"
  },customer.token));
  assert.equal(result.status,200);
  const body=await result.json();
  assert.match(body.bookingCode,/^HALA-[A-F0-9]{12}$/);
  assert.equal(body.paymentStatus,"pending_payment");
  const saved=await postgres.query("SELECT * FROM booking_requests");
  assert.equal(saved.rows.length,1);
  assert.equal(saved.rows[0].booking_code,body.bookingCode);
  assert.equal(saved.rows[0].payment_status,"pending_payment");
  assert.equal(saved.rows[0].customer_user_id,"prebook-customer");
  const notifications=await postgres.query("SELECT channel,recipient,status FROM booking_notifications ORDER BY channel");
  assert.deepEqual(notifications.rows,[
    {channel:"email",recipient:"bookings@halainvites.com",status:"queued"},
    {channel:"whatsapp",recipient:"966532763736",status:"queued"}
  ]);
  assert.equal(notificationChannelReady("email"),false);
  assert.equal(notificationChannelReady("whatsapp"),false);
  const denied=await adminBookings(request("/api/admin/bookings",undefined,customer.token,"GET"));
  assert.equal(denied.status,403);
  const list=await adminBookings(request("/api/admin/bookings?page=1",undefined,admin.token,"GET"));
  assert.equal(list.status,200);
  const data=await list.json();
  assert.equal(data.stats.total,1);
  assert.equal(data.stats.paid_count,0);
  assert.equal(data.bookings[0].email_status,"queued");
  const falsePaid=await adminBookings(request("/api/admin/bookings",{
    id:saved.rows[0].id,status:"confirmed",staffNotes:"لا يوجد دفع"
  },admin.token,"PATCH"));
  assert.equal(falsePaid.status,409);
  const updated=await adminBookings(request("/api/admin/bookings",{
    id:saved.rows[0].id,status:"contacted",staffNotes:"تم الاتصال"
  },admin.token,"PATCH"));
  assert.equal(updated.status,200);
  const pending=await postgres.query("SELECT status,staff_notes,payment_status FROM booking_requests");
  assert.equal(pending.rows[0].status,"contacted");
  assert.equal(pending.rows[0].staff_notes,"تم الاتصال");
  assert.equal(pending.rows[0].payment_status,"pending_payment");
});
