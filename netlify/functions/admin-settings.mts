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
  return secureJson({error:'عدّل تسعير تنظيم الدخول من كتالوج الباقات المركزي',code:'USE_ADMIN_CATALOG'},409);
};
export const config:Config={path:"/api/admin/settings"};