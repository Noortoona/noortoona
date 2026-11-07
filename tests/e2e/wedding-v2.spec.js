import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
const designs=JSON.parse(readFileSync(new URL('../../shared/wedding-templates.json',import.meta.url),'utf8'));

async function startWedding(page){
  await page.addInitScript(()=>localStorage.setItem('halaAnalyticsConsent','no'));
  await page.goto('/');
  await page.locator('[data-start]:visible').first().click();
  await page.locator('[data-occasion="wedding"]').click();
  await page.locator('#nextBtn').click();
  await page.locator('#name1').fill('محمد عبدالله');await page.locator('#name2').fill('نورة خالد');
  await page.locator('#date').fill('2027-02-12');await page.locator('#time').fill('21:30');
  await page.locator('#location').fill('قصر الرياض — المدخل الرئيسي');
  await page.locator('#nextBtn').click();
}

for(const [index,t]of designs.entries())test(`${t.name}: choose, personalize, restore, save real event and open guest link`,async({page,request},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await startWedding(page);
  await expect(page.locator('#builderBody .wedding-template-card')).toHaveCount(16);
  await page.locator('#builderBody [data-template="'+t.name+'"]').click();
  await page.locator('#nextBtn').click();
  const preview=page.locator('.host-phone .wedding-v2');
  await expect(preview).toHaveAttribute('data-template-id','wedding-v2-'+t.slug);
  const longName='عبدالرحمن بن عبدالعزيز بن عبدالله آل عبدالرحمن العتيبي';
  await page.locator('#name1').fill(longName);await page.locator('#name2').fill('الأميرة نورة بنت عبدالرحمن بن عبدالعزيز آل عبدالله');
  await expect(preview.locator('.wedding-names')).toContainText(longName);
  await page.locator('#eventTitleInput').fill('حفل زفافنا');
  await page.locator('#headline').fill('بكل الحب ننتظركم');
  await page.locator('#message').fill('نسعد بمشاركتكم فرحتنا في هذه الليلة');
  await page.locator('#designNotes').fill('حضوركم أجمل هدية');
  await page.locator('#font').selectOption('amiri');await page.locator('#textColor').selectOption(t.textColors[1]);
  await page.locator('#accent').fill('#8a642e');
  await page.locator('#ornaments').uncheck();
  if(t.alignments.length>1)await page.locator('#alignment').selectOption(t.alignments.at(-1));
  await expect(preview).toHaveAttribute('data-ornaments','false');
  await page.evaluate(()=>document.fonts.ready);
  const sizes=await preview.evaluate(el=>({canvas:el.getBoundingClientRect().width,scroll:el.scrollWidth,copy:el.querySelector('.wedding-copy').getBoundingClientRect().width,copyScroll:el.querySelector('.wedding-copy').scrollWidth,viewport:innerWidth,document:document.documentElement.scrollWidth,names:[...el.querySelectorAll('.wedding-names>span')].map(n=>({client:n.clientWidth,scroll:n.scrollWidth}))}));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.canvas+1);expect(sizes.copyScroll).toBeLessThanOrEqual(sizes.copy+1);
  for(const name of sizes.names)expect(name.scroll).toBeLessThanOrEqual(name.client+1);
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  await page.locator('[data-full-preview]').click();
  await expect(page.locator('#journeyFullPreview .wedding-v2')).toHaveAttribute('data-template-id','wedding-v2-'+t.slug);
  await page.locator('[data-preview-mode="full"]').click();
  await expect(page.locator('[data-preview-mode="full"]')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');await expect(page.locator('#builderModal')).toHaveClass(/open/);
  await page.reload();await page.locator('#resumeDraft').click();
  await expect(page.locator('#name1')).toHaveValue(longName);await expect(page.locator('#designNotes')).toHaveValue('حضوركم أجمل هدية');
  await expect(page.locator('#textColor')).toHaveValue(t.textColors[1]);await expect(page.locator('#message')).toHaveValue('نسعد بمشاركتكم فرحتنا في هذه الليلة');
  // Save a short readable specimen after exercising long-name wrapping.
  await page.locator('#name1').fill('محمد عبدالله');await page.locator('#name2').fill('نورة خالد');
  await page.locator('#font').selectOption(t.font);await page.locator('#textColor').selectOption(t.textColors[0]);await page.locator('#accent').fill(t.accent.toLowerCase());await page.locator('#ornaments').check();if(t.alignments.length>1)await page.locator('#alignment').selectOption(t.alignments[0]);
  await page.locator('#nextBtn').click();
  await page.locator('#guestText').fill('ضيف المعاينة، 0531112233');
  await page.locator('#nextBtn').click();await page.locator('#nextBtn').click();
  await page.locator('#contactName').fill('عميل اختبار معزول');await page.locator('#contactPhone').fill('0531112244');
  await expect(page.locator('#nextBtn')).toBeEnabled();await page.locator('#nextBtn').click();
  await expect(page.locator('.booking-success')).toBeVisible();
  const owner=await page.evaluate(()=>JSON.parse(localStorage.getItem('noortoonaOwner')));
  let saved;await expect.poll(async()=>{saved=await(await request.get('/api/dashboard?event='+owner.eventId,{headers:{'x-noortoona-owner-token':owner.ownerToken}})).json();return saved.guests?.length}).toBe(1);
  expect(saved.event.design_json.templateId).toBe('wedding-v2-'+t.slug);expect(saved.event.template).toBe(t.name);
  expect(saved.event.design_json.notes).toBe('حضوركم أجمل هدية');expect(saved.event.design_json.headline).toBe('بكل الحب ننتظركم');expect(saved.event.message).toBe('نسعد بمشاركتكم فرحتنا في هذه الليلة');expect(saved.event.package_name).toBe('هلا بلس');
  const code=saved.guests[0].code;
  // This is the same target as the production /i/:code rewrite, against the real local API.
  await page.goto('/guest.html?code='+code);
  await expect(page.locator('.wedding-v2')).toHaveAttribute('data-template-id','wedding-v2-'+t.slug);
  await expect(page.locator('.wedding-names')).toBeVisible();await expect(page.locator('.wedding-names>span').first()).toBeVisible();await expect(page.locator('.wedding-names')).toContainText('محمد عبدالله');
  await expect(page.locator('.wedding-v2')).toContainText('حفل زفافنا');await expect(page.locator('.wedding-notes')).toContainText('حضوركم أجمل هدية');
  await expect(page.getByRole('link',{name:/عرض موقع المناسبة/})).toBeVisible();
  await expect(page.locator('.guest-qr img')).toHaveAttribute('src',/^data:image/);
  await page.evaluate(()=>document.fonts.ready);await page.locator('.wedding-background img').evaluate(img=>img.decode());
  mkdirSync('test-results/wedding-v2/'+testInfo.project.name,{recursive:true});
  await page.locator('.wedding-v2').screenshot({path:'test-results/wedding-v2/'+testInfo.project.name+'/'+t.slug+'.png'});
  if(index===0){await page.getByRole('button',{name:'نعم، سأحضر',exact:true}).click();await page.locator('#confirmRsvp').click();await expect(page.locator('#rsvpResult')).toContainText('تم تأكيد حضورك')}
  await page.reload();await expect(page.locator('.wedding-v2')).toHaveAttribute('data-template-id','wedding-v2-'+t.slug);
  expect(errors).toEqual([]);
});

test('gallery filters, image failures, keyboard focus, reduced motion and lazy image budget',async({page})=>{
  const originals=[];page.on('request',req=>{if(/\/wedding-v2\/[^/]+(?<!-thumb)(?<!-mobile)\.(?:webp|jpg)$/.test(req.url()))originals.push(req.url())});
  await page.addInitScript(()=>localStorage.setItem('halaAnalyticsConsent','no'));await page.goto('/');
  await expect(page.locator('#templateGrid .wedding-template-card')).toHaveCount(16);
  for(const f of ['minimal','formal','romantic','luxury','curated']){
    await page.locator('#templateGrid [data-landing-filter="'+f+'"]').click();
    await expect(page.locator('#templateGrid .wedding-template-card')).toHaveCount(designs.filter(t=>f==='curated'?t.curated:t.tags.includes(f)).length);
  }
  expect(originals).toEqual([]);
  await page.locator('#templateGrid [data-landing-filter="all"]').click();
  await page.locator('#templateGrid [data-template-preview="صفاء"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#journeyFullPreview')).toBeVisible();
  await expect(page.locator('[data-preview-close]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.locator('[data-preview-select]')).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('[data-preview-close]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#templateGrid [data-template-preview="صفاء"]')).toBeFocused();
  await page.route('**/*ivory-royal-thumb.*',route=>route.abort());await page.reload();
  await page.locator('#templateGrid [data-card-template="ملكي عاجي"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#templateGrid [data-card-template="ملكي عاجي"] .thumbnail-status')).toContainText('تعذر تحميل الصورة');
  await page.emulateMedia({reducedMotion:'reduce'});
  const duration=await page.locator('#templateGrid [data-landing-filter="all"]').evaluate(el=>getComputedStyle(el).transitionDuration);expect(duration).toBe('0s');
});

test('custom background validates bytes, rejects SVG, and survives draft reload',async({page,request})=>{
  await startWedding(page);await page.locator('#builderBody [data-template="صفاء"]').click();await page.locator('#nextBtn').click();
  await page.locator('#designImage').setInputFiles({name:'fake.jpg',mimeType:'image/jpeg',buffer:Buffer.from('<svg onload="alert(1)"></svg>')});
  await expect(page.locator('#toast')).toContainText('محتوى الملف');
  await expect(page.locator('.host-phone .wedding-v2')).toHaveAttribute('data-custom-background','false');
  await page.locator('#designImage').setInputFiles(new URL('../../assets/templates/wedding-v2/pure-elegance-thumb.jpg',import.meta.url).pathname);
  await expect(page.locator('.host-phone .wedding-v2')).toHaveAttribute('data-custom-background','true');
  await page.reload();await page.locator('#resumeDraft').click();await expect(page.locator('.host-phone .wedding-v2')).toHaveAttribute('data-custom-background','true');
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('noortoonaDraftV55')));
  const response=await request.post('/api/events',{headers:{origin:new URL(page.url()).origin},data:{...draft,occasion:'زواج'}});
  expect(response.status()).toBe(200);const saved=await response.json();expect(saved.event.design_json.image).toBe(draft.design.image);
  const forged=await request.post('/api/events',{headers:{origin:new URL(page.url()).origin},data:{...draft,occasion:'زواج',design:{...draft.design,image:'data:image/jpeg;base64,/9j/YWJj'}}});
  expect(forged.status()).toBe(400);
  await page.locator('#removeImage').click();await expect(page.locator('.host-phone .wedding-v2')).toHaveAttribute('data-custom-background','false');
});

test('all twelve designs retain maximum-length Arabic names and notes at 320px',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/');
  const results=await page.evaluate(()=>{
    const root=document.createElement('div');root.style.width='300px';document.body.replaceChildren(root);
    return window.NOORTOONA.weddingTemplates.map(t=>{
      root.innerHTML=window.NOORTOONA.canvas({occasionKey:'wedding',name1:'عبدالرحمن '.repeat(18).slice(0,180),name2:'نورة بنت عبدالله '.repeat(14).slice(0,180),message:'يسعدنا حضوركم '.repeat(30),date:'2027-02-12',location:'قصر الرياض — المدخل الرئيسي',template:t.name,design:{templateId:t.id,notes:'حضوركم أجمل هدية '.repeat(32).slice(0,500)}});
      const canvas=root.firstElementChild,copy=root.querySelector('.wedding-copy'),names=[...root.querySelectorAll('.wedding-names>span')];
      return {id:t.id,canvas:canvas.clientWidth,scroll:canvas.scrollWidth,bottom:canvas.getBoundingClientRect().bottom,copyBottom:copy.getBoundingClientRect().bottom,names:names.map(n=>({client:n.clientWidth,scroll:n.scrollWidth,height:n.clientHeight}))};
    });
  });
  for(const result of results){expect(result.scroll,result.id).toBeLessThanOrEqual(result.canvas+1);expect(result.copyBottom,result.id).toBeLessThanOrEqual(result.bottom);for(const name of result.names){expect(name.scroll,result.id).toBeLessThanOrEqual(name.client+1);expect(name.height,result.id).toBeGreaterThan(0)}}
});
