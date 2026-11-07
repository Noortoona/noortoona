// Check the real Netlify preview with synthetic event/guest fixtures only.
// Confirm the deploy uses a separate Netlify database branch before --write-fixtures.
// Production hosts are deliberately rejected. No bookings, payments or messages are sent.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import manifest from '../shared/wedding-templates.json' with {type:'json'};

const target=new URL(process.argv[2]||'');
assert.ok(target.protocol==='https:'&&!target.username&&!target.password&&/^deploy-preview-\d+--noortoona\.netlify\.app$/.test(target.hostname),'Use a HALA Netlify Deploy Preview, never a production host.');
const base=target.origin,writeFixtures=process.argv.includes('--write-fixtures');
const output='test-results/netlify-wedding-preview.json';
let previous={};try{previous=JSON.parse(await readFile(output,'utf8'))}catch{}
const records=previous.baseUrl===base?previous.templates||[]:[];
if(records.length!==12&&!writeFixtures)throw Error('No complete QA fixtures exist. Verify preview DB isolation, then pass --write-fixtures.');
const proxyAddress=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
let proxy;
if(proxyAddress){const p=new URL(proxyAddress);proxy={server:p.protocol+'//'+p.host,...(p.username?{username:decodeURIComponent(p.username),password:decodeURIComponent(p.password)}:{})};}
const browser=await chromium.launch({headless:true,proxy});
try{
  const context=await browser.newContext({locale:'ar-SA',timezoneId:'Asia/Riyadh',viewport:{width:1280,height:900}});
  await context.addInitScript(()=>{try{if(window.top===window)localStorage.setItem('halaAnalyticsConsent','no')}catch{}});
  const page=await context.newPage(),errors=[],toolbarWarnings=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()!=='error')return;if(/Refused to frame 'https:\/\/app\.netlify\.com\/'/.test(m.text()))toolbarWarnings.push(m.text());else if(/Content Security Policy|Refused to/i.test(m.text()))errors.push(m.text());});
  const catalogResponse=await context.request.get(base+'/api/catalog');assert.equal(catalogResponse.status(),200);
  const catalogBefore=await catalogResponse.json();assert.equal(catalogBefore.packages.length,3);
  const root=await page.goto(base+'/#templates');assert.equal(root.status(),200);assert.match(root.headers()['content-security-policy'],/font-src 'self'/);
  await page.locator('#templateGrid [data-template-preview="'+manifest[0].name+'"]').waitFor();
  assert.equal(await page.evaluate(()=>window.NOORTOONA.weddingTemplates.length),12);
  for(const t of manifest){
    await page.locator('#templateGrid [data-template-preview="'+t.name+'"]').click();
    assert.equal(await page.locator('#journeyFullPreview .wedding-v2').getAttribute('data-template-id'),'wedding-v2-'+t.slug);
    await page.locator('[data-preview-close]').click();
  }
  // Exercise the compatibility boundary in the deployed host editor as well.
  await page.locator('[data-start]:visible').first().click();await page.locator('[data-occasion="wedding"]').click();await page.locator('#nextBtn').click();
  await page.locator('#name1').fill('محمد عبدالله');await page.locator('#name2').fill('نورة خالد');await page.locator('#date').fill('2027-02-12');await page.locator('#location').fill('موقع معاينة تجريبي');await page.locator('#nextBtn').click();
  await page.locator('#builderBody [data-template="ملكي عاجي"]').click();await page.locator('#nextBtn').click();await page.locator('#font').selectOption('amiri');await page.locator('#prevBtn').click();
  await page.locator('#builderBody [data-template="ليلة كحلية"]').click();await page.locator('#nextBtn').click();assert.equal(await page.locator('#font').inputValue(),'amiri');await page.locator('.builder-shell>[data-close]').click();
  const verified=[];
  for(const t of manifest){
    let fixture=records.find(r=>r.slug===t.slug);
    if(!fixture){
      assert.ok(writeFixtures);
      const response=await context.request.post(base+'/api/events',{headers:{origin:base},data:{occasion:'زواج',occasionKey:'wedding',name1:'محمد عبدالله',name2:'نورة خالد',title:'QA23 — معاينة '+t.name,date:'2027-02-12',time:'21:30',location:'الرياض — موقع تجريبي',message:'دعوة تجريبية لمراجعة التصميم فقط',template:t.name,package:'hala_plus',requestSupervisor:false,design:{occasionKey:'wedding',templateId:'wedding-v2-'+t.slug,font:t.font,headline:'بكل الحب ندعوكم',notes:'بيانات عرض تجريبية فقط',showQr:true,showMap:true}}});
      const saved=await response.json();assert.equal(response.status(),200,JSON.stringify({template:t.name,error:saved.error}));
      assert.equal(saved.event.design_json.templateId,'wedding-v2-'+t.slug);
      const added=await context.request.post(base+'/api/guests',{headers:{origin:base,'x-noortoona-owner-token':saved.ownerToken},data:{eventId:saved.event.id,name:'ضيف هلا — معاينة تجريبية'}});
      const data=await added.json();assert.equal(added.status(),200,JSON.stringify({template:t.name,error:data.error}));
      fixture={slug:t.slug,name:t.name,eventId:saved.event.id,url:base+'/i/'+data.guest.code};records.push(fixture);
      // Only public synthetic invitation URLs are retained; owner tokens are never written.
      await mkdir('test-results',{recursive:true});await writeFile(output,JSON.stringify({baseUrl:base,templates:records},null,2));
    }
    const invite=await page.goto(fixture.url);assert.equal(invite.status(),200);
    await page.locator('.wedding-v2').waitFor();assert.equal(await page.locator('.wedding-v2').getAttribute('data-template-id'),'wedding-v2-'+t.slug);
    assert.match(await page.locator('.wedding-names').innerText(),/محمد عبدالله/);
    assert.ok(await page.locator('.wedding-names').isVisible());
    assert.ok(await page.locator('.guest-qr img').isVisible());assert.match(await page.locator('.guest-qr img').getAttribute('src'),/^data:image/);
    assert.equal(await page.getByRole('link',{name:/عرض موقع المناسبة/}).count(),1);
    await page.locator('.wedding-background img').evaluate(img=>img.decode());
    verified.push(fixture);console.log('Verified preview:',t.name);
  }
  const catalogAfter=await(await context.request.get(base+'/api/catalog')).json();
  assert.deepEqual(catalogAfter.packages,catalogBefore.packages);assert.deepEqual(errors,[]);
  await writeFile(output,JSON.stringify({baseUrl:base,checkedAt:new Date().toISOString(),templates:verified,packages:catalogAfter.packages.map(p=>({code:p.code,amount:p.amount,guestLimit:p.guestLimit})),browserErrors:errors,previewToolbarBlockedByExistingCsp:toolbarWarnings.length},null,2));
  console.log('All twelve persisted preview invitations render correctly; package configuration is unchanged.');
}finally{await browser.close()}
