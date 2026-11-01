import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { publicUser, recordAudit, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, normalizePhone, secureJson } from "./_shared/domain.mjs";
export default async(req:Request)=>{
 const auth=await requireRole(req,["admin"]);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 const db=getDatabase();
 if(req.method==="GET"){const rows=await db.sql`SELECT id,name,email,phone,role,status,created_at FROM users ORDER BY created_at DESC LIMIT 500`;return secureJson({users:rows.map(publicUser)})}
 if(req.method!=="POST"&&req.method!=="PATCH")return new Response("Method Not Allowed",{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
 if(req.method==="PATCH"){
   let client:any;
   try{
     const body:any=await req.json(),userId=String(body.userId||""),status=String(body.status||"");
     if(!userId||!["active","suspended"].includes(status))return secureJson({error:"حالة المستخدم غير صالحة"},400);
     if(userId===auth.user.id)return secureJson({error:"لا يمكن تغيير حالة حسابك الإداري من هذه اللوحة"},409);
     client=await db.pool.connect();await client.query("BEGIN");
     const target=(await client.query("SELECT id,role,status FROM users WHERE id=$1 FOR UPDATE",[userId])).rows[0];
     if(!target){await client.query("ROLLBACK");return secureJson({error:"المستخدم غير موجود"},404);}
     if(target.role==="admin"){await client.query("ROLLBACK");return secureJson({error:"تعديل حسابات الإدارة يتطلب إجراءً منفصلًا"},409);}
     const user=(await client.query("UPDATE users SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,email,phone,role,status",[status,userId])).rows[0];
     if(status==="suspended")await client.query("DELETE FROM sessions WHERE user_id=$1",[userId]);
     await client.query("COMMIT");client.release();client=null;
     await recordAudit(auth.user.id,"admin.user_status","user",userId,{previousStatus:target.status,status,role:target.role});
     return secureJson({user:publicUser(user)});
   }catch(error){if(client)await client.query("ROLLBACK").catch(()=>undefined);console.error(error);return secureJson({error:"تعذر تعديل حالة المستخدم"},500);}
   finally{if(client)client.release();}
 }
 try{const b:any=await req.json(),name=String(b.name||"").trim().slice(0,120),phone=normalizePhone(b.phone||""),role=b.role==="supervisor"?"supervisor":"customer";if(name.length<2||!/^[1-9]\d{7,14}$/.test(phone))return secureJson({error:"تحقق من الاسم ورقم الجوال"},400);
 const rows=await db.sql`INSERT INTO users(id,name,phone,role) VALUES(${crypto.randomUUID()},${name},${phone},${role})
 ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,role=CASE WHEN users.role IN ('admin','partner') THEN users.role ELSE EXCLUDED.role END,updated_at=NOW()
 RETURNING id,name,email,phone,role,status`;
 await recordAudit(auth.user.id,"admin.user_upsert","user",rows[0].id,{role});return secureJson({user:publicUser(rows[0])},201)}
 catch(error){console.error(error);return secureJson({error:"تعذر حفظ المستخدم"},500)}
};
export const config:Config={path:"/api/admin/users"};
