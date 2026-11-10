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
