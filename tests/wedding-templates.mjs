import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
import manifest from '../shared/wedding-templates.json' with {type:'json'};
import {TEMPLATE_KEYS,normalizeCatalog,applyCatalogPatch,availableTemplate} from '../netlify/functions/_shared/catalog.mjs';
import {normalizeWeddingPayload} from '../netlify/functions/_shared/wedding-design.mjs';
import {rasterDimensions} from '../netlify/functions/_shared/image-metadata.mjs';

const context={window:{},URL};
vm.runInNewContext(await readFile(new URL('../invitation-renderer.js',import.meta.url),'utf8'),context);
const N=context.window.NOORTOONA;
const templates=N.weddingTemplates;

test('twelve unique V2 designs extend the four unchanged legacy wedding artworks',()=>{
  assert.equal(templates.length,12);assert.equal(N.catalog.wedding.length,16);
  for(const key of ['id','name','slug','background'])assert.equal(new Set(templates.map(t=>t[key])).size,12);
  assert.deepEqual(manifest.reduce((a,t)=>(a[t.collection]=(a[t.collection]||0)+1,a),{}),{royal:4,minimal:4,romantic:4});
  const legacy=N.catalog.wedding.filter(t=>t.version!==2);
  assert.equal(legacy.map(t=>t.name).join('|'),'ليلة كحلية|حديقة اللؤلؤ|أقواس ذهبية|مخمل ملكي');
  assert.equal(legacy.map(t=>t.position).join('|'),'0% 50%|33.333% 50%|66.667% 50%|100% 50%');
  assert.equal(legacy.every(t=>t.atlas==='/assets/templates/atlas-social.webp'),true);
  assert.equal(TEMPLATE_KEYS.length,96);
  for(const t of templates)assert.equal(TEMPLATE_KEYS.find(k=>k.id===t.id)?.key,'wedding:'+t.name);
});

test('filters follow manifest tags, curated is editorial, and hidden templates remain hidden',()=>{
  for(const key of ['luxury','formal','minimal','romantic','curated']){
    const expected=templates.filter(t=>key==='curated'?t.curated:t.tags.includes(key)).map(t=>t.id).join();
    assert.equal(N.filterTemplates(templates,key).map(t=>t.id).join(),expected);
  }
  assert.equal(N.weddingFilters.some(f=>/طلب/.test(f.label)),false);
  const hidden=['wedding:'+templates[0].name],catalog=applyCatalogPatch(normalizeCatalog(),{hiddenTemplateKeys:hidden});
  assert.equal(N.templateChoices('wedding',hidden).some(t=>t.id===templates[0].id),false);
  assert.equal(availableTemplate(catalog,{occasionKey:'wedding'},templates[0].name),false);
  assert.equal(availableTemplate(catalog,{occasionKey:'wedding'},templates[1].name),true);
});

test('every design has real optimized desktop, mobile, thumbnail and compatible fallback assets',async()=>{
  for(const t of templates){
    for(const key of ['background','mobile','thumbnail','fallback','thumbnailFallback']){
      const file=new URL('..'+t[key],import.meta.url),bytes=await readFile(file);
      assert.ok(bytes.length>100,t.id+' '+key);
      if(key.endsWith('Fallback')||key==='fallback')assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');
      else{assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');}
      assert.ok((await stat(file)).size<(key==='thumbnail'||key==='thumbnailFallback'?45000:350000),t.id+' asset budget');
    }
    assert.match(N.weddingPicture(t,true),/loading="lazy"/);
    assert.doesNotMatch(N.weddingPicture(t,true),/srcset="[^" ]+(?<!-thumb)\.webp"/);
  }
});

const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
test('text palettes have at least WCAG AA contrast against their reading surface and fonts include OFL licenses',async()=>{
  for(const t of templates)for(const text of t.textColors){const a=luminance(text),b=luminance(t.surface);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,t.id+' '+text)}
  for(const name of ['Amiri','ArefRuqaa','Tajawal'])assert.match(await readFile(new URL('../assets/fonts/'+name+'-OFL.txt',import.meta.url),'utf8'),/SIL OPEN FONT LICENSE/i);
});

test('text, style and image payloads cannot inject HTML, script or CSS; stable IDs recover saved designs',()=>{
  for(const t of templates){
    const payload={template:t.name,name1:'<img src=x onerror=alert(1)>',name2:'نورة',occasionKey:'wedding',location:'<script>bad</script>',design:{templateId:t.id,font:'constructor',accent:'#fff;--x:url(javascript:1)',textColor:'red',eventTitle:'<svg onload=bad()>',notes:'<script>window.bad=1</script>',image:'javascript:alert(1)'}};
    const before=JSON.stringify(payload),html=N.canvas(payload);
    assert.equal(JSON.stringify(payload),before,'rendering must not mutate persisted data');
    assert.match(html,new RegExp('data-template-id="'+t.id+'"'));
    assert.doesNotMatch(html,/<script|<svg|<img src=x|javascript:|--x:/);
    assert.match(html,/&lt;script&gt;/);
    assert.equal(N.templateByName('اسم قديم تغيّر','wedding',t.id).id,t.id);
    assert.equal(N.templateByName(t.name,'wedding','wedding-v2-unavailable').id,t.id);
  }
  assert.match(N.canvas({template:'قالب غير متاح',name1:'اسم محفوظ',design:{templateId:'wedding-v2-removed'}}),/اسم محفوظ/);
});

test('server normalizes V2 settings without changing QR, RSVP, maps, price or legacy design values',()=>{
  for(const t of manifest){
    const raw={occasionKey:'wedding',templateId:'wedding-v2-'+t.slug,showQr:true,showMap:true,showMaybe:false,notes:'رسالة',accent:'bad',textColor:'white',font:'constructor'};
    const result=normalizeWeddingPayload(t.name,raw);
    assert.equal(result.template,t.name);assert.equal(result.design.templateId,raw.templateId);
    for(const key of ['showQr','showMap','showMaybe','notes'])assert.equal(result.design[key],raw[key]);
    assert.equal(result.design.font,t.font);assert.equal(result.design.textColor,t.textColors[0]);assert.equal(result.design.accent,t.accent);
    assert.throws(()=>normalizeWeddingPayload(t.name,{...raw,occasionKey:'activity'}),/غير متوافق/);
    assert.throws(()=>normalizeWeddingPayload(t.name,{...raw,image:'data:image/svg+xml;base64,PHN2Zz4='}),/خلفية|خلفيته/);
    assert.throws(()=>normalizeWeddingPayload(t.name,{...raw,image:'data:image/jpeg;base64,PHNjcmlwdD4='}),/محتوى|خلفيته/);
  }
  assert.throws(()=>normalizeWeddingPayload(manifest[0].name,{templateId:'wedding-v2-midnight-prestige'}),/لا يطابق/);
  assert.throws(()=>normalizeWeddingPayload('غير متاح',{templateId:'wedding-v2-missing'}),/غير متاح/);
  const legacy={showQr:false,font:'serif',customFutureField:'preserve'};assert.equal(normalizeWeddingPayload('ليلة كحلية',legacy).design,legacy);
});

test('server checks actual raster dimensions and rejects tiny forged files and oversized pixel canvases',async()=>{
  for(const [extension,mime]of [['jpg','jpeg'],['webp','webp']]){
    const bytes=await readFile(new URL('../assets/templates/wedding-v2/pure-elegance-thumb.'+extension,import.meta.url));
    assert.deepEqual(rasterDimensions(bytes,mime),{width:320,height:480});
    const uri='data:image/'+mime+';base64,'+bytes.toString('base64');
    assert.equal(normalizeWeddingPayload('صفاء',{image:uri}).design.image,uri);
  }
  const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(9999,16);png.writeUInt32BE(9999,20);
  assert.throws(()=>normalizeWeddingPayload('صفاء',{image:'data:image/png;base64,'+png.toString('base64')}),/20 ميجابكسل/);
  for(const bytes of [Buffer.from([255,216,255]),Buffer.from([255,216,255,225,0,0])])assert.throws(()=>rasterDimensions(bytes,'jpeg'),/أبعاد/);
});
