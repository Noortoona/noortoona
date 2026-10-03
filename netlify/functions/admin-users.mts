import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { publicUser, recordAudit, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, normalizePhone, secureJson } from "./_shared/domain.mjs";
export default async(req:Request)=>{
 const auth=await requireRole(req,["admin"]);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 const db=getDatabase();
 if(req.method==="GET"){const rows=await db.sql`SELECT id,name,email,phone,role,status,created_at FROM users ORDER BY created_at DESC LIMIT 500`;return secureJson({users:rows.map(publicUser)})}
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
 try{const b:any=await req.json(),name=String(b.name||"").trim().slice(0,120),phone=normalizePhone(b.phone||""),role=b.role==="supervisor"?"supervisor":"customer";if(name.length<2||!/^[1-9]\d{7,14}$/.test(phone))return secureJson({error:"تحقق من الاسم ورقم الجوال"},400);
 const rows=await db.sql`INSERT INTO users(id,name,phone,role) VALUES(${crypto.randomUUID()},${name},${phone},${role})
 ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,updated_at=NOW()
 RETURNING id,name,email,phone,role,status`;
 await recordAudit(auth.user.id,"admin.user_upsert","user",rows[0].id,{role});return secureJson({user:publicUser(rows[0])},201)}
 catch(error){console.error(error);return secureJson({error:"تعذر حفظ المستخدم"},500)}
};
export const config:Config={path:"/api/admin/users"};