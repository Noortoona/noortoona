import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { linkEventMember, recordAudit, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
export default async(req:Request)=>{
 const auth=await requireRole(req,["admin"]);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 const db=getDatabase();
 if(req.method==="GET"){
   const requests=await db.sql`
    SELECT sr.*,e.title,e.occasion,e.event_date,e.city,cu.name customer_name,cu.phone customer_phone,
           su.name supervisor_name,su.phone supervisor_phone
    FROM supervisor_requests sr
    JOIN events e ON e.id=sr.event_id
    JOIN users cu ON cu.id=sr.user_id
    LEFT JOIN users su ON su.id=sr.assigned_supervisor_id
    ORDER BY CASE sr.status WHEN 'requested' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END,sr.created_at DESC LIMIT 200`;
   const supervisors=await db.sql`SELECT id,name,phone,status FROM users WHERE role='supervisor' ORDER BY name`;
   return secureJson({requests,supervisors});
 }
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
 try{const b:any=await req.json(),requestId=String(b.requestId||""),supervisorId=String(b.supervisorId||"");
 if(!requestId||!supervisorId)return secureJson({error:"اختر الطلب والمشرف"},400);
 const sup=await db.sql`SELECT id FROM users WHERE id=${supervisorId} AND role='supervisor' AND status='active' LIMIT 1`;if(!sup[0])return secureJson({error:"المشرف غير متاح"},404);
 const rows=await db.sql`UPDATE supervisor_requests SET assigned_supervisor_id=${supervisorId},status='assigned',updated_at=NOW() WHERE id=${requestId} AND status='requested' AND EXISTS (SELECT 1 FROM payment_orders p WHERE p.event_id=supervisor_requests.event_id AND p.status='paid' AND p.supervisor_addon_amount>=supervisor_requests.amount) RETURNING *`;
 const r:any=rows[0];if(!r)return secureJson({error:"الطلب غير مدفوع أو لم يعد قابلًا للتعيين"},409);
 await linkEventMember(r.event_id,supervisorId,"supervisor");
 await recordAudit(auth.user.id,"supervisor.assigned","event",r.event_id,{requestId,supervisorId});
 return secureJson({request:r});
 }catch(error){console.error(error);return secureJson({error:"تعذر تعيين المشرف"},500)}
};
export const config:Config={path:"/api/admin/supervisors"};
