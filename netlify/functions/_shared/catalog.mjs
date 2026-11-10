import { publicPackages } from './payments.mjs';
import { POLICY_VERSION, GUEST_COUNTS, ENTRY_DEFAULTS, TAX_DEFAULTS, BUSINESS_DEFAULTS, tierFor, featuresFor } from '../../../shared/pricing-policy.mjs';
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
  const allowed=new Set(['packages','hiddenTemplateKeys','services','expectedRevision','entry','tax','business','effectiveAt']);
  if(Object.keys(patch).some(key=>!allowed.has(key)))throw invalid('حقل كتالوج غير معروف');
  const next={...current,packages:current.packages.map(p=>({...p})),hiddenTemplateKeys:[...current.hiddenTemplateKeys],services:current.services.map(s=>({...s}))};
  if(patch.packages!==undefined){
    if(!Array.isArray(patch.packages)||patch.packages.length>3)throw invalid('قائمة الباقات غير صالحة');
    const seen=new Set();
    for(const value of patch.packages){
      const target=next.packages.find(p=>p.code===value?.code);
      if(!target||seen.has(value.code))throw invalid('كود الباقة غير صالح أو مكرر');seen.add(value.code);
      if(value.priceTiers!==undefined){
        if(!value.priceTiers||Object.keys(value.priceTiers).length!==3||!GUEST_COUNTS.every(n=>Number.isInteger(value.priceTiers[n])&&value.priceTiers[n]>=100&&value.priceTiers[n]<=10_000_000))throw invalid('أسعار الأعداد الثلاثة غير صالحة');
        target.priceTiers={...value.priceTiers};target.amount=target.priceTiers[100];target.amountSar=target.amount/100;target.guestLimit=500;
      }else if(value.amount!==undefined||value.guestLimit!==undefined){
        // Compatibility with older admin clients: edit the 100-guest tier only.
        if(!Number.isInteger(value.amount)||value.amount<100||value.amount>10_000_000||!Number.isInteger(value.guestLimit)||value.guestLimit<1||value.guestLimit>5000)throw invalid('سعر الباقة أو حد المدعوين غير صالح');
        target.amount=value.amount;target.amountSar=value.amount/100;target.guestLimit=value.guestLimit;target.priceTiers={...target.priceTiers,[value.guestLimit]:value.amount};
      }
      if(value.enabled!==undefined){if(typeof value.enabled!=='boolean')throw invalid('حالة الباقة غير صالحة');target.enabled=value.enabled;}
      if(value.features!==undefined){
        if(!Array.isArray(value.features)||value.features.length>30||value.features.some(f=>!f||typeof f.ar!=='string'||!f.ar.trim()||f.ar.length>300||typeof f.en!=='string'||!f.en.trim()||f.en.length>300||!['included','assisted','external'].includes(f.status)||!/^[a-z][a-z0-9_]{1,40}$/.test(f.id)))throw invalid('مميزات الباقة غير صالحة');
        target.features=value.features.map(f=>({id:f.id,ar:f.ar,en:f.en,status:f.status}));
      }
    }
  }
  if(!next.packages.some(p=>p.enabled!==false))throw invalid('يجب إبقاء باقة واحدة متاحة');
  if(patch.entry!==undefined){
    const e=patch.entry;
    if(!e||!Number.isInteger(e.unitAmount)||e.unitAmount<100||e.unitAmount>1_000_000||typeof e.enabled!=='boolean'||e.standardHours!==null&&(!Number.isFinite(e.standardHours)||e.standardHours<=0||e.standardHours>24))throw invalid('قواعد تنظيم الدخول غير صالحة');
    next.entry={unitAmount:e.unitAmount,standardHours:e.standardHours,enabled:e.enabled};
  }
  if(patch.tax!==undefined){
    const t=patch.tax;
    if(!t||!['unconfigured','not_registered','registered'].includes(t.status)||t.status==='registered'&&(!/^3[0-9]{13}3$/.test(t.registrationNumber)||!Number.isInteger(t.rateBps)||t.rateBps<0||t.rateBps>10000||typeof t.pricesIncludeTax!=='boolean'))throw invalid('تحقق من الإعداد الضريبي ورقم التسجيل');
    next.tax=t.status==='registered'?{status:t.status,rateBps:t.rateBps,pricesIncludeTax:t.pricesIncludeTax,registrationNumber:t.registrationNumber}:{...TAX_DEFAULTS,status:t.status};
  }
  if(patch.business!==undefined){
    if(!Array.isArray(patch.business)||patch.business.length!==2||!BUSINESS_DEFAULTS.every(d=>patch.business.some(p=>p.code===d.code&&Number.isInteger(p.startingAmount)&&p.startingAmount>=100&&p.startingAmount<=100_000_000)))throw invalid('أسعار الأعمال غير صالحة');
    next.business=BUSINESS_DEFAULTS.map(d=>({...d,startingAmount:patch.business.find(p=>p.code===d.code).startingAmount}));
  }
  if(patch.effectiveAt!==undefined){if(patch.effectiveAt!==null&&(!Number.isFinite(Date.parse(patch.effectiveAt))||Date.parse(patch.effectiveAt)<Date.now()-60000))throw invalid('موعد سريان الأسعار غير صالح');next.effectiveAt=patch.effectiveAt;}
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
  const defaults={version:2,policyVersion:POLICY_VERSION,revision:0,packages:publicPackages(),entry:{...ENTRY_DEFAULTS},tax:{...TAX_DEFAULTS},business:BUSINESS_DEFAULTS.map(p=>({...p})),hiddenTemplateKeys:[],services:DEFAULT_SERVICES.map(s=>({...s})),effectiveAt:null};
  if(!stored||typeof stored!=='object'||Array.isArray(stored))throw new Error('INVALID_STORED_CATALOG');
  // Existing bookings/orders keep their own amounts. V1 prices are not V2 tiers.
  const patch={};for(const key of ['hiddenTemplateKeys','services',...(stored.version===2?['packages','entry','tax','business']:[])])if(stored[key]!==undefined)patch[key]=stored[key];
  const result=applyCatalogPatch(defaults,patch);
  result.revision=Number.isInteger(stored.revision)&&stored.revision>=0?stored.revision:0;
  if(stored.scheduled)result.scheduled=stored.scheduled;
  return result;
}

export async function readCatalog(db) {
  const rows=await db.sql`SELECT value FROM platform_settings WHERE key=${CATALOG_KEY} LIMIT 1`;
  const stored=rows[0]?.value?JSON.parse(rows[0].value):{};
  if(stored.scheduled&&Date.parse(stored.scheduled.effectiveAt)<=Date.now())return normalizeCatalog(stored.scheduled.catalog);
  return normalizeCatalog(stored);
}

export function publicCatalog(catalog) {
  const {scheduled,...safe}=catalog;return {...safe,packages:catalog.packages.filter(p=>p.enabled!==false).map(p=>({...p,includedFeatures:featuresFor(p,catalog.packages)})),services:catalog.services.filter(s=>s.enabled)};
}

export function catalogPackage(catalog, code, count) {
  const pkg=catalog.packages.find(p=>p.enabled!==false&&(p.code===String(code||'')||p.name===String(code||'')))||null;
  return count===undefined?pkg:tierFor(pkg,count);
}

export function availableTemplate(catalog, design={}, template='') {
  const occasionKey=String(design?.occasionKey||'');
  const group=occasionKey==='activity'?String(design?.activityKey||''):occasionKey;
  // Legacy payloads without canonical keys still cannot select a hidden design by name.
  if(!group)return !TEMPLATE_KEYS.some(t=>t.name===String(template||'')&&catalog.hiddenTemplateKeys.includes(t.key));
  const key=group+':'+String(template||'');
  return templateSet.has(key)&&!catalog.hiddenTemplateKeys.includes(key);
}

export function templateMinimumPackage(design={},template=''){
 const group=design.occasionKey==='activity'?design.activityKey:design.occasionKey;
 const templates=TEMPLATE_KEYS.filter(t=>t.group===group);
 const index=templates.findIndex(t=>t.name===template);
 return index>=2?'hala_plus':'hala_basic';
}
export function packageSupportsTemplate(pkg,design={},template=''){return pkg?.code!=='hala_basic'||templateMinimumPackage(design,template)==='hala_basic';}
export { TEMPLATE_KEYS };
