import type { Config } from "@netlify/functions";
import { secureJson } from "./_shared/domain.mjs";
import { readCatalog, catalogPackage } from "./_shared/catalog.mjs";
import { supervisorAddonHalalas } from "./_shared/settings.mjs";
import { getDatabase } from "@netlify/database";

export default async (req: Request) => {
  if(req.method!=="GET")return new Response("Method Not Allowed",{status:405});
  try{
    const url=new URL(req.url),code=url.searchParams.get("package"),supervisor=url.searchParams.get("supervisor")==="1";
    const db=getDatabase(),catalog=await readCatalog(db),addon=await supervisorAddonHalalas(db);
    if(!code)return secureJson({packages:catalog.packages,supervisorAddonAmount:addon,supervisorAddonSar:addon/100});
    const base=catalogPackage(catalog,code);
    if(!base)return secureJson({error:"الباقة غير صحيحة"},400);
    const total=base.amount+(supervisor?addon:0);
    return secureJson({packageCode:base.code,baseAmount:base.amount,guestLimit:base.guestLimit,currency:base.currency,supervisorAddonAmount:supervisor?addon:0,totalAmount:total,amountSar:total/100});
  }catch(error){console.error(error);return secureJson({error:"تعذر تحميل الأسعار الحالية"},503)}
};
export const config: Config={path:"/api/pricing/quote"};
