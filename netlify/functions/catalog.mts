import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { secureJson } from './_shared/domain.mjs';
import { publicCatalog, readCatalog } from './_shared/catalog.mjs';

export default async (req: Request) => {
  if(req.method!=='GET')return new Response('Method Not Allowed',{status:405});
  try{return secureJson(publicCatalog(await readCatalog(getDatabase())))}
  catch(error){console.error(error);return secureJson({error:'تعذر تحميل الباقات والخدمات'},503)}
};
export const config: Config={path:'/api/catalog'};
