import type { Config } from "@netlify/functions";
import { secureJson } from "./_shared/domain.mjs";
import { publicPackages, quote } from "./_shared/payments.mjs";
import { supervisorAddonHalalas } from "./_shared/settings.mjs";
import { getDatabase } from "@netlify/database";
export default async(req:Request)=>{
 if(req.method!=="GET")return new Response("Method Not Allowed",{status:405});
 const u=new URL(req.url),pkg=u.searchParams.get("package"),supervisor=u.searchParams.get("supervisor")==="1";
 const addon=await supervisorAddonHalalas(getDatabase());
 if(!pkg)return secureJson({packages:publicPackages(),supervisorAddonAmount:addon,supervisorAddonSar:addon/100});
 const base=quote(pkg,false);if(!base)return secureJson({error:"الباقة غير صحيحة"},400);const total=base.baseAmount+(supervisor?addon:0);return secureJson({...base,supervisorAddonAmount:supervisor?addon:0,totalAmount:total,amountSar:total/100})
};
export const config:Config={path:"/api/pricing/quote"};