import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { requireRole } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";
export default async(req:Request)=>{
 if(req.method!=="GET")return new Response("Method Not Allowed",{status:405});
 const auth=await requireRole(req,["customer"]);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 try{const db=getDatabase();
 const events=await db.sql`
   SELECT e.id,e.title,e.occasion,e.event_date,e.event_time,e.city,e.location,e.package_name,e.created_at,
          sr.status supervisor_status,sr.amount supervisor_amount,sr.assigned_supervisor_id,
          COUNT(g.id)::int guests,
          COUNT(g.id) FILTER(WHERE g.rsvp_status='accepted')::int accepted,
          COUNT(g.id) FILTER(WHERE g.checked_in_at IS NOT NULL)::int checked_in
   FROM event_members em JOIN events e ON e.id=em.event_id
   LEFT JOIN guests g ON g.event_id=e.id
   LEFT JOIN supervisor_requests sr ON sr.event_id=e.id
   WHERE em.user_id=${auth.user.id} AND em.member_role='owner'
   GROUP BY e.id,sr.status,sr.amount,sr.assigned_supervisor_id
   ORDER BY e.created_at DESC LIMIT 60`;
 return secureJson({user:auth.user,events});}
 catch(error){console.error(error);return secureJson({error:"تعذر تحميل مناسباتك"},500)}
};
export const config:Config={path:"/api/customer/home"};