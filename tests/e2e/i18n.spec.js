import { test, expect } from "@playwright/test";

test("website language picker switches RTL/LTR and remembers English after reload", async ({ page }) => {
  await page.goto("/");
  const picker = page.locator(".nav-actions .hala-language-picker select");
  await expect(picker).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await picker.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".hero-copy h1")).toContainText("Your moment");
  await expect(picker).toHaveValue("en");

  await page.reload();
  await expect(picker).toHaveValue("en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".hero-copy h1")).toContainText("Your moment");

  await picker.selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".hero-copy h1")).toContainText("لحظتك");
});

test("booking builder shows translated interface after selecting English", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-actions .hala-language-picker select").selectOption("en");
  await page.locator(".hero-actions [data-start]").click();
  await expect(page.locator("#builderModal")).toHaveClass(/open/);
  await expect(page.locator("#builderBody")).toContainText("Choose an occasion");
  await expect(page.locator("#nextBtn")).toContainText("Next");
});
