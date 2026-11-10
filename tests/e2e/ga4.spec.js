import {test,expect} from '@playwright/test';
async function productionFixture(page,request,baseURL){
 const scripts=[];
 await page.route('https://www.googletagmanager.com/**',async route=>{scripts.push(route.request().url());await route.fulfill({contentType:'text/javascript',body:'/* isolated GA SDK fixture; never contacts Google */'});});
 await page.route('https://halainvites.com/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/ga4-config.js')return route.fulfill({contentType:'text/javascript',body:'window.HALA_GA4_CONFIG={enabled:true,measurementId:"G-TEST123456"};'});
  if(url.pathname==='/api/analytics/track')return route.fulfill({status:201,json:{ok:true}});
  const response=await request.get(baseURL+url.pathname+url.search);
  await route.fulfill({status:response.status(),headers:{'content-type':response.headers()['content-type']||'text/plain'},body:await response.body()});
 });
 return scripts;
}

test('Google measurement waits for informed consent and strips URL/contact data',async({page,request,baseURL})=>{
 const scripts=await productionFixture(page,request,baseURL);
 await page.goto('https://halainvites.com/?email=private%40example.com&code=PRIVATE_TOKEN&utm_source=google');
 await expect(page.getByRole('button',{name:'السماح بالقياس',exact:true})).toBeVisible();
 expect(scripts).toHaveLength(0);
 await page.getByRole('button',{name:'السماح بالقياس',exact:true}).click();
 await expect.poll(()=>scripts.length).toBe(1);
 await page.locator('.hero [data-start]').click();
 await expect(page.locator('#builderModal')).toHaveAttribute('aria-hidden','false');
 const commands=await page.evaluate(()=>Array.from(window.halaGa4DataLayer||[],c=>Array.from(c)));
 expect(commands.filter(c=>c[0]==='event'&&c[1]==='page_view')).toHaveLength(1);
 expect(commands.some(c=>c[0]==='event'&&c[1]==='booking_started')).toBeTruthy();
 expect(JSON.stringify(commands)).not.toMatch(/private@example.com|PRIVATE_TOKEN/);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'تفضيلات الخصوصية',exact:true}).click();
 await page.getByRole('button',{name:'متابعة دون قياس',exact:true}).click();
 expect(await page.evaluate(()=>window.HALA_GA4.status().consented)).toBe(false);
 expect(await page.evaluate(()=>window['ga-disable-G-TEST123456'])).toBe(true);
});

test('legacy first-party consent does not authorize Google automatically',async({page,request,baseURL})=>{
 const scripts=await productionFixture(page,request,baseURL);
 await page.addInitScript(()=>localStorage.setItem('halaAnalyticsConsent','yes'));
 await page.goto('https://halainvites.com/');
 await expect(page.getByRole('region',{name:'خيارات الخصوصية'})).toContainText('Google Analytics 4');
 expect(scripts).toHaveLength(0);
 await page.getByRole('button',{name:'متابعة دون قياس',exact:true}).click();
 await page.locator('.hero [data-start]').click();
 await expect(page.locator('#builderModal')).toHaveAttribute('aria-hidden','false');
 expect(scripts).toHaveLength(0);
});
