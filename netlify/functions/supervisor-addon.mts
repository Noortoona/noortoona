import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { canAccessEvent, recordAudit, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
function priceHalalas(){const n=Number(Netlify.env.get("HALA_SUPERVISOR_ADDON_SAR")||199);return Math.max(0,Math.round(n*100))}
export default async(req:Request)=>{
 const amount=priceHalalas();
 if(req.method==="GET"&&!new URL(req.url).searchParams.get("eventId"))return secureJson({amount,amountSar:amount/100,currency:"SAR"});
 const auth=await requireRole(req,["customer"]);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 const db=getDatabase();
 if(req.method==="GET"){const id=String(new URL(req.url).searchParams.get("eventId")||"");if(!id||!await canAccessEvent(auth.user,id))return secureJson({error:"غير مصرح"},403);const rows=await db.sql`SELECT * FROM supervisor_requests WHERE event_id=${id} LIMIT 1`;return secureJson({request:rows[0]||null,amount,amountSar:amount/100,currency:"SAR"})}
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
 try{const b:any=await req.json(),eventId=String(b.eventId||""),requested=b.requested!==false;if(!eventId||!await canAccessEvent(auth.user,eventId))return secureJson({error:"غير مصرح"},403);
   if(!requested){const rows=await db.sql`UPDATE supervisor_requests SET status='canceled',updated_at=NOW() WHERE event_id=${eventId} AND user_id=${auth.user.id} RETURNING *`;await recordAudit(auth.user.id,"supervisor.canceled","event",eventId,{});return secureJson({request:rows[0]||null})}
   const rows=await db.sql`INSERT INTO supervisor_requests(id,event_id,user_id,amount,status) VALUES(${crypto.randomUUID()},${eventId},${auth.user.id},${amount},'requested')
    ON CONFLICT(event_id) DO UPDATE SET user_id=EXCLUDED.user_id,amount=EXCLUDED.amount,status='requested',updated_at=NOW() RETURNING *`;
   await recordAudit(auth.user.id,"supervisor.requested","event",eventId,{amount});
   return secureJson({request:rows[0],amount,amountSar:amount/100,currency:"SAR"},201);
 }catch(error){console.error(error);return secureJson({error:"تعذر تحديث طلب المشرف"},500)}
};
export const config:Config={path:"/api/events/supervisor"};