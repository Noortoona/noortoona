import { test, expect } from "@playwright/test";

test("HALA approved luxury landing hero renders real wordmark, image, and booking entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero.hero-luxury")).toBeVisible();
  await expect(page.locator(".luxury-title-top")).toHaveText("لحظتك تبدأ بـ");
  await expect(page.locator(".luxury-wordmark")).toBeVisible();
  await expect(page.locator(".luxury-signature-rule img")).toHaveCount(1);
  const image = await page.request.get("/assets/brand/hala-hero-photo.webp");
  expect(image.ok()).toBeTruthy();
  expect(image.headers()["content-type"]).toContain("image/webp");
  await expect(page.locator("#digital-invitations")).toContainText("دعوة زواج إلكترونية");
  await page.locator(".hero-actions [data-start]").click();
  await expect(page.locator("#builderModal")).toHaveClass(/open/);
});

test("luxury landing hero adapts to mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".luxury-title")).toBeVisible();
  await expect(page.locator(".hero-actions [data-start]")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("English language switch updates headline and branded primary action", async ({ page }) => {
  await page.goto("/");
  const picker = page.locator(".nav-actions .hala-language-picker select");
  await picker.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".luxury-title-top")).toHaveText("Your moment starts with");
  await expect(page.locator(".hero-actions [data-start]")).toHaveText("Create your invitation");
  await expect(page.locator(".luxury-wordmark")).toHaveAttribute("alt", "HALA");
});
