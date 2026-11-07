// Reproducible, synthetic visual references. No customer or payment data is used.
// Run npm run build, then node scripts/capture-wedding-previews.mjs.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';
import manifest from '../shared/wedding-templates.json' with {type:'json'};

const root=resolve(new URL('..',import.meta.url).pathname),output=resolve(root,'docs/wedding-v2/previews');
await mkdir(output,{recursive:true});
const types={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const labels={royal:'فخم ورسمي',minimal:'بسيط وأنيق',romantic:'رومانسي فاخر'};
const cards=manifest.map(t=>`<article><img src="/__qa/${t.slug}.jpg" alt="${t.name}"><h2>${t.name}</h2><p>${labels[t.collection]}</p></article>`).join('');
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  try{
    if(path==='/__preview'){
      res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/v2.css"><link rel="stylesheet" href="/wedding.css"><style>body{margin:0;background:#FBF7EF}#stage{width:390px;margin:0}.wedding-v2{border-radius:0!important}</style><div id="stage"></div><script src="/invitation-renderer.js"></script></html>');return;
    }
    if(path==='/__grid'){
      res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/wedding.css"><style>*{box-sizing:border-box}body{margin:0;background:#F2EEE6;font-family:Tajawal,sans-serif;color:#1A2330}.sheet{width:1440px;padding:38px}.title{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}.title img{width:150px}.title h1{font:400 34px Amiri;margin:0}.title p{margin:8px 0;color:#655D53}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 20px}article{background:#FFFDF9;border:1px solid #D6CBBA;border-radius:12px;overflow:hidden;min-width:0}article>img{width:100%;display:block;aspect-ratio:390/725;object-fit:contain;background:#F8F1E5}h2{font:700 23px 'Aref Ruqaa';margin:15px 18px 8px}article p{margin:0 18px 18px;font-size:13px;color:#655D53}.foot{font-size:14px;color:#655D53;margin:25px 0 0}</style><main class="sheet"><header class="title"><div><h1>مكتبة الزواج — اثنا عشر تصميمًا جديدًا</h1><p>معاينات فعلية من محرّك الدعوات • Wedding Luxury V2</p></div><img src="/assets/brand/hala-logo-dark.svg" alt="هلا HALA"></header><div class="grid">${cards}</div><p class="foot">النصوص والأسماء للعرض فقط. جميع الخلفيات أصول أصلية داخل المشروع.</p></main></html>`);return;
    }
    const file=path.startsWith('/__qa/')?resolve(output,path.slice(6)):resolve(root,'dist','.'+path);
    if(!file.startsWith(output+'/')&&!file.startsWith(resolve(root,'dist')+'/'))throw Error('invalid path');
    const bytes=await readFile(file);res.setHeader('content-type',types[extname(file)]||'application/octet-stream');res.setHeader('content-length',bytes.length);res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolveReady=>server.listen(0,'127.0.0.1',resolveReady));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{
  let page=await browser.newPage({viewport:{width:420,height:1300},deviceScaleFactor:2,locale:'ar-SA'});
  await page.goto(base+'/__preview');
  for(const t of manifest){
    await page.evaluate(t=>{
      document.getElementById('stage').innerHTML=window.NOORTOONA.canvas({occasionKey:'wedding',occasion:'زواج',name1:'محمد عبدالله',name2:'نورة خالد',date:'2027-02-12',time:'21:30',location:'قصر الرياض',message:'يسعدنا حضوركم ومشاركتنا فرحتنا',template:t.name,design:{templateId:'wedding-v2-'+t.slug,font:t.font,headline:'بكل الحب ندعوكم',notes:'حضوركم أجمل هدية'}},{guestName:'ضيف هلا'});
    },t);
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('.wedding-background img').evaluate(img=>img.decode());
    await page.locator('.wedding-v2').screenshot({path:resolve(output,t.slug+'.jpg'),type:'jpeg',quality:88});
  }
  await page.close();page=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1,locale:'ar-SA'});await page.goto(base+'/__grid');await page.evaluate(()=>document.fonts.ready);
  await page.locator('.sheet').screenshot({path:resolve(root,'docs/wedding-v2/preview-grid.jpg'),type:'jpeg',quality:90});
  console.log('Captured twelve invitation references and their labelled contact sheet.');
}finally{await browser.close();await new Promise(done=>server.close(done));}
