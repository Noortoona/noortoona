import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { requireRole } from './_shared/auth.mjs';
import { isSameOriginRequest, secureJson } from './_shared/domain.mjs';
import { applyCatalogPatch, CATALOG_KEY, normalizeCatalog, readCatalog, TEMPLATE_KEYS } from './_shared/catalog.mjs';

export default async(req: Request)=>{
  const auth=await requireRole(req,['admin']);if(!auth.ok)return secureJson({error:auth.error},auth.status);
  if(!['GET','PATCH'].includes(req.method))return new Response('Method Not Allowed',{status:405});
  const db=getDatabase();
  if(req.method==='GET'){
    try{return secureJson({...await readCatalog(db),templateKeys:TEMPLATE_KEYS})}
    catch(error){console.error(error);return secureJson({error:'تعذر تحميل الكتالوج'},503)}
  }
  if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
  if(Number(req.headers.get('content-length')||0)>50_000)return secureJson({error:'حجم الطلب أكبر من المسموح'},413);
  let client:any;
  try{
    const patch:any=await req.json();
    if(JSON.stringify(patch).length>50_000)return secureJson({error:'حجم الطلب أكبر من المسموح'},413);
    client=await db.pool.connect();await client.query('BEGIN');
    await client.query("INSERT INTO platform_settings(key,value) VALUES($1,'{}') ON CONFLICT(key) DO NOTHING",[CATALOG_KEY]);
    const rows=await client.query('SELECT value FROM platform_settings WHERE key=$1 FOR UPDATE',[CATALOG_KEY]);
    const current=normalizeCatalog(JSON.parse(rows.rows[0].value));
    if(patch.expectedRevision!==undefined&&patch.expectedRevision!==current.revision){await client.query('ROLLBACK');return secureJson({error:'تغيّر الكتالوج؛ حدّث الصفحة قبل الحفظ'},409)}
    const next=applyCatalogPatch(current,patch);next.revision=current.revision+1;
    await client.query('UPDATE platform_settings SET value=$2,updated_at=NOW() WHERE key=$1',[CATALOG_KEY,JSON.stringify(next)]);
    await client.query('INSERT INTO audit_log(id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[crypto.randomUUID(),auth.user.id,'admin.catalog_updated','settings',CATALOG_KEY,JSON.stringify({revision:next.revision,fields:Object.keys(patch).filter(k=>k!=='expectedRevision')})]);
    await client.query('COMMIT');return secureJson({...next,templateKeys:TEMPLATE_KEYS});
  }catch(error:any){if(client)await client.query('ROLLBACK').catch(()=>undefined);if(error?.status===400)return secureJson({error:error.message},400);console.error(error);return secureJson({error:'تعذر حفظ الكتالوج'},500)}
  finally{client?.release()}
};
export const config: Config={path:'/api/admin/catalog'};
