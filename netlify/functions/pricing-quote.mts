import type { Config } from "@netlify/functions";
import { secureJson } from "./_shared/domain.mjs";
import { publicPackages, quote, supervisorAddonHalalas } from "./_shared/payments.mjs";
export default async(req:Request)=>{
 if(req.method!=="GET")return new Response("Method Not Allowed",{status:405});
 const u=new URL(req.url),pkg=u.searchParams.get("package"),supervisor=u.searchParams.get("supervisor")==="1";
 if(!pkg)return secureJson({packages:publicPackages(),supervisorAddonAmount:supervisorAddonHalalas(),supervisorAddonSar:supervisorAddonHalalas()/100});
 const q=quote(pkg,supervisor);return q?secureJson(q):secureJson({error:"الباقة غير صحيحة"},400)
};
export const config:Config={path:"/api/pricing/quote"};