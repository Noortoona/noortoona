import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { recordAudit, requireRole } from "./_shared/auth.mjs";
import { isSameOriginRequest, secureJson } from "./_shared/domain.mjs";
import { supervisorAddonHalalas } from "./_shared/settings.mjs";

export default async(req:Request)=>{
  const auth=await requireRole(req,["admin"]);if(!auth.ok)return secureJson({error:auth.error},auth.status);
  const db=getDatabase();
  if(req.method==="GET"){
    const amount=await supervisorAddonHalalas(db);
    return secureJson({supervisorAddonAmount:amount,supervisorAddonSar:amount/100});
  }
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  if(!isSameOriginRequest(req))return secureJson({error:"طلب غير مسموح"},403);
  try{
    const body:any=await req.json(),sar=Number(body.supervisorAddonSar);
    if(!Number.isFinite(sar)||sar<0||sar>10000)return secureJson({error:"سعر المشرف غير صالح"},400);
    const value=String(Math.round(sar*100)/100);
    await db.sql`INSERT INTO platform_settings(key,value,updated_at) VALUES('supervisor_addon_sar',${value},NOW())
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
    await recordAudit(auth.user.id,"settings.supervisor_price","settings","supervisor_addon_sar",{value});
    return secureJson({supervisorAddonSar:Number(value),supervisorAddonAmount:Math.round(Number(value)*100)});
  }catch(error){console.error(error);return secureJson({error:"تعذر حفظ الإعداد"},500)}
};
export const config:Config={path:"/api/admin/settings"};