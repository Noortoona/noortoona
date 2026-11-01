import { publicPackages } from './payments.mjs';
import { TEMPLATE_KEYS } from './template-registry.mjs';

export const CATALOG_KEY = 'catalog_config_v1';
export const DEFAULT_SERVICES = [
  {id:'venues',name:'القاعات والمواقع',description:'قاعات ومواقع مناسبة لنوع المناسبة وعدد الضيوف.',enabled:true},
  {id:'photography',name:'التصوير',description:'تصوير وتغطية حسب نوع المناسبة والتوفر.',enabled:true},
  {id:'flowers',name:'الورد والتنسيق',description:'تنسيق المداخل والطاولات وهوية المناسبة.',enabled:true},
  {id:'hospitality',name:'الضيافة والحلويات',description:'ضيافة وحلويات مناسبة لعدد المدعوين.',enabled:true},
  {id:'entertainment',name:'الصوت والترفيه',description:'صوت وترفيه للفعاليات والاحتفالات حسب الحاجة.',enabled:true},
  {id:'gifts',name:'الهدايا والتوزيعات',description:'هدايا وتوزيعات متوافقة مع هوية المناسبة.',enabled:true},
];
const invalid = message => Object.assign(new Error(message),{status:400});
const templateSet = new Set(TEMPLATE_KEYS.map(t=>t.key));

export function applyCatalogPatch(current, patch) {
  if(!patch || typeof patch!=='object'||Array.isArray(patch))throw invalid('بيانات الكتالوج غير صالحة');
  const allowed=new Set(['packages','hiddenTemplateKeys','services','expectedRevision']);
  if(Object.keys(patch).some(key=>!allowed.has(key)))throw invalid('حقل كتالوج غير معروف');
  const next={...current,packages:current.packages.map(p=>({...p})),hiddenTemplateKeys:[...current.hiddenTemplateKeys],services:current.services.map(s=>({...s}))};
  if(patch.packages!==undefined){
    if(!Array.isArray(patch.packages)||patch.packages.length>3)throw invalid('قائمة الباقات غير صالحة');
    const seen=new Set();
    for(const value of patch.packages){
      const target=next.packages.find(p=>p.code===value?.code);
      if(!target||seen.has(value.code))throw invalid('كود الباقة غير صالح أو مكرر');seen.add(value.code);
      if(!Number.isInteger(value.amount)||value.amount<100||value.amount>10_000_000||!Number.isInteger(value.guestLimit)||value.guestLimit<1||value.guestLimit>5000)throw invalid('سعر الباقة أو حد المدعوين غير صالح');
      target.amount=value.amount;target.amountSar=value.amount/100;target.guestLimit=value.guestLimit;
      if(target.referenceAmount){
        if(target.amount<target.referenceAmount)target.savingsPercent=Math.round((1-target.amount/target.referenceAmount)*100);
        else for(const key of ['referenceAmount','referenceAmountSar','savingsPercent','promoLicenseId'])delete target[key];
      }
    }
  }
  if(patch.hiddenTemplateKeys!==undefined){
    if(!Array.isArray(patch.hiddenTemplateKeys)||patch.hiddenTemplateKeys.length>TEMPLATE_KEYS.length||patch.hiddenTemplateKeys.some(key=>!templateSet.has(key)))throw invalid('قالب غير معروف');
    next.hiddenTemplateKeys=[...new Set(patch.hiddenTemplateKeys)];
    const hidden=new Set(next.hiddenTemplateKeys);
    for(const group of new Set(TEMPLATE_KEYS.map(t=>t.group)))if(TEMPLATE_KEYS.filter(t=>t.group===group).every(t=>hidden.has(t.key)))throw invalid('يجب إبقاء قالب واحد متاح على الأقل لكل نوع مناسبة');
  }
  if(patch.services!==undefined){
    if(!Array.isArray(patch.services)||patch.services.length>30)throw invalid('قائمة الخدمات غير صالحة');
    const ids=new Set();
    next.services=patch.services.map(value=>{
      if(!value||typeof value.id!=='string'||!/^[a-z][a-z0-9_-]{1,39}$/.test(value.id)||ids.has(value.id)||typeof value.name!=='string'||value.name.trim().length<2||value.name.length>80||typeof value.description!=='string'||value.description.length>400||typeof value.enabled!=='boolean')throw invalid('بيانات الخدمة غير صالحة أو مكررة');
      ids.add(value.id);return {id:value.id,name:value.name.trim(),description:value.description.trim(),enabled:value.enabled};
    });
  }
  return next;
}

export function normalizeCatalog(stored={}) {
  const defaults={version:1,revision:0,packages:publicPackages(),hiddenTemplateKeys:[],services:DEFAULT_SERVICES.map(s=>({...s}))};
  if(!stored||typeof stored!=='object'||Array.isArray(stored))throw new Error('INVALID_STORED_CATALOG');
  const patch={};for(const key of ['packages','hiddenTemplateKeys','services'])if(stored[key]!==undefined)patch[key]=stored[key];
  const result=applyCatalogPatch(defaults,patch);
  result.revision=Number.isInteger(stored.revision)&&stored.revision>=0?stored.revision:0;
  return result;
}

export async function readCatalog(db) {
  const rows=await db.sql`SELECT value FROM platform_settings WHERE key=${CATALOG_KEY} LIMIT 1`;
  return normalizeCatalog(rows[0]?.value?JSON.parse(rows[0].value):{});
}

export function publicCatalog(catalog) {
  return {...catalog,services:catalog.services.filter(s=>s.enabled)};
}

export function catalogPackage(catalog, code) {
  return catalog.packages.find(p=>p.code===String(code||'')||p.name===String(code||''))||null;
}

export function availableTemplate(catalog, design={}, template='') {
  const occasionKey=String(design?.occasionKey||'');
  const group=occasionKey==='activity'?String(design?.activityKey||''):occasionKey;
  // Legacy payloads without canonical keys still cannot select a hidden design by name.
  if(!group)return !TEMPLATE_KEYS.some(t=>t.name===String(template||'')&&catalog.hiddenTemplateKeys.includes(t.key));
  const key=group+':'+String(template||'');
  return templateSet.has(key)&&!catalog.hiddenTemplateKeys.includes(key);
}

export { TEMPLATE_KEYS };
