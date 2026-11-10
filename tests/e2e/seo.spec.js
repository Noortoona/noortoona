import { test, expect } from "@playwright/test";

test("Original HALA homepage remains intact and links to real occasion pages", async ({page}) => {
  await page.goto("/");
  await expect(page.locator(".hero h1")).toContainText("لحظتك");
  await expect(page.locator(".hero [data-start]")).toBeVisible();
  await expect(page.locator(".hero-scene")).toBeVisible();
  await expect(page.locator(".occasion-note a[href='/wedding-invitations.html']")).toHaveText("زواج");
});

test("SEO occasion pages are usable on mobile with correct titles and navigation", async ({page}) => {
  for (const [slug,part] of [["wedding-invitations","زواج"],["engagement-invitations","ملكة"],["graduation-invitations","تخرج"]]) {
    await page.goto("/"+slug+".html");
    await expect(page.locator("h1")).toContainText(part);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href","https://halainvites.com/"+slug+".html");
    await expect(page.getByRole("link",{name:"ابدأ تصميم دعوتك"})).toHaveAttribute("href","/#home");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("Robots and sitemap URLs are publicly available", async ({request}) => {
  const robots=await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Sitemap: https://halainvites.com/sitemap.xml");
  const sitemap=await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("https://halainvites.com/wedding-invitations.html");
});

test('Official footer social links are accessible and keep the approved destinations',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'متابعة دون قياس',exact:true}).click();
 const links=page.locator('footer .hala-social-links');
 await links.scrollIntoViewIfNeeded();
 for(const [name,url] of [['Instagram','https://www.instagram.com/halainvites/'],['TikTok','https://www.tiktok.com/@halainvites']]){
  const link=links.getByRole('link',{name:new RegExp(name)});
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href',url);
  await expect(link).toHaveAttribute('target','_blank');
  await expect(link).toHaveAttribute('rel','noopener noreferrer');
  expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
 }
 await expect(links.getByRole('link',{name:'hello@halainvites.com'})).toHaveAttribute('href','mailto:hello@halainvites.com');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('Translated guides have useful content and reciprocal Arabic navigation',async({page})=>{
 for(const slug of ['wedding-invitations','engagement-invitations','graduation-invitations']){
  await page.goto('/'+slug+'-en.html');
  const decline=page.getByRole('button',{name:'Continue without measurement',exact:true});
  if(await decline.isVisible())await decline.click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://halainvites.com/'+slug+'-en.html');
  await expect(page.getByRole('link',{name:'العربية'})).toHaveAttribute('href','/'+slug+'.html');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 }
});

test('Declining optional measurement still allows moving from a guide to the invitation builder',async({page})=>{
 const analytics=[];
 await page.route('**/api/analytics/track',async route=>{analytics.push(route.request().postDataJSON());await route.fulfill({status:201,json:{ok:true}})});
 await page.goto('/wedding-invitations-en.html?utm_source=google');
 await page.getByRole('button',{name:'Continue without measurement',exact:true}).click();
 await page.getByRole('link',{name:'Start designing your invitation',exact:true}).click();
 await expect(page).toHaveURL(/\/#home$/);
 await page.locator('.hero [data-start]').click();
 await expect(page.locator('#builderModal')).toHaveAttribute('aria-hidden','false');
 expect(analytics).toHaveLength(0);
});

test('Consented guide-to-builder measurement strips contact details and invitation tokens',async({page})=>{
 const analytics=[];
 await page.route('**/api/analytics/track',async route=>{analytics.push(route.request().postDataJSON());await route.fulfill({status:201,json:{ok:true}})});
 await page.goto('/wedding-invitations-en.html?utm_source=google&utm_campaign=private%40example.com&email=private%40example.com&code=PRIVATE_TOKEN');
 await page.getByRole('button',{name:'Allow measurement',exact:true}).click();
 await page.getByRole('link',{name:'Start designing your invitation',exact:true}).click();
 await expect(page).toHaveURL(/\/#home$/);
 await page.locator('.hero [data-start]').click();
 await expect(page.locator('#builderModal')).toHaveAttribute('aria-hidden','false');
 await expect.poll(()=>analytics.some(e=>e.event==='booking_started')).toBeTruthy();
 const click=analytics.find(e=>e.event==='invitation_cta_clicked');
 expect(click.path).toBe('/wedding-invitations-en.html');
 expect(click.attribution.utm_source).toBe('google');
 expect(click.metadata.occasion).toBe('wedding');
 expect(JSON.stringify(analytics)).not.toMatch(/private@example\.com|PRIVATE_TOKEN/);
 expect(analytics.filter(e=>e.event==='booking_started')).toHaveLength(1);
});
