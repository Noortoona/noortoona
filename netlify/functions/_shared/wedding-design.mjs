import manifest from '../../../shared/wedding-templates.json' with {type:'json'};
import {rasterDimensions} from './image-metadata.mjs';

const invalid=message=>Object.assign(new Error(message),{status:400});
const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
export function normalizeWeddingPayload(template,design={}){
  const supplied=String(template||''),id=String(design.templateId||'');
  const byName=manifest.find(t=>t.name===supplied),byId=manifest.find(t=>'wedding-v2-'+t.slug===id);
  if(id.startsWith('wedding-v2-')&&!byId)throw invalid('القالب غير متاح؛ اختر قالبًا آخر');
  if(byId&&supplied&&byId.name!==supplied)throw invalid('معرّف القالب لا يطابق التصميم المختار');
  const t=byId||byName;if(!t)return {template,design};
  if(design.occasionKey&&design.occasionKey!=='wedding')throw invalid('قالب الزواج غير متوافق مع نوع المناسبة');
  const image=String(design.image||'');
  if(image){
    if(!t.customBackground)throw invalid('هذا القالب يحتفظ بخلفيته الأصلية');
    const match=image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if(!match||image.length>600000)throw invalid('خلفية الدعوة غير صالحة أو أكبر من المسموح');
    const bytes=Buffer.from(match[2],'base64'),mime=match[1];
    const valid=mime==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    if(!valid)throw invalid('محتوى الملف لا يطابق صيغة الصورة');
    rasterDimensions(bytes,mime);
  }
  return {template:t.name,design:{...design,occasionKey:'wedding',templateId:'wedding-v2-'+t.slug,templateVersion:2,
    font:['amiri','ruqaa','tajawal'].includes(design.font)?design.font:t.font,
    accent:color(design.accent,t.accent),textColor:t.textColors.includes(design.textColor)?design.textColor:t.textColors[0],
    align:t.alignments.includes(design.align)?design.align:t.alignments[0],ornaments:design.ornaments!==false,
    eventTitle:String(design.eventTitle||'دعوة زفاف').slice(0,100),headline:String(design.headline||'بكل الحب ندعوكم').slice(0,140),
    notes:String(design.notes||'').slice(0,500),image,
  }};
}
