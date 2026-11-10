import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const webSource = readFileSync(new URL("../i18n.js", import.meta.url), "utf8");
const localeSandbox = {
  document: { readyState: "loading", addEventListener() {} },
  window: {}
};
runInNewContext(webSource, localeSandbox, { filename: "i18n.js" });
const i18n = localeSandbox.window.HALA_I18N;

test("Arabic is the default and untranslated user content is preserved", () => {
  assert.equal(i18n.getLocale(), "ar");
  assert.equal(i18n.t("المناسبات", "ar"), "المناسبات");
  assert.equal(i18n.t("اسم عميل مخصص", "en"), "اسم عميل مخصص");
  assert.equal(i18n.t("Ahmed & Sarah", "en"), "Ahmed & Sarah");
});

test("English has real interface translations and locale switch updates direction", () => {
  assert.equal(i18n.t("المناسبات", "en"), "Occasions");
  assert.equal(i18n.t("أنشئ مناسبتك", "en"), "Create your event");
  assert.equal(i18n.t("تأكيد الحجز", "en"), "Confirm booking");
  assert.match(webSource, /document\.documentElement\.dir = locale === "ar" \? "rtl" : "ltr"/);
  assert.match(webSource, /localStorage\.setItem\(STORAGE_KEY, locale\)/);
});

test("Every public HTML entry point includes the isolated language switch", () => {
  for (const file of ["index.html", "admin.html", "booking.html", "customer.html", "dashboard.html", "guest.html", "partner.html", "supervisor.html"]) {
    const html = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    assert.match(html, /src="\/i18n\.js"/, file);
    assert.match(html, /href="\/i18n\.css"/, file);
  }
});

test("Expo mounts a locale provider and exposes a direct language switch", () => {
  const root = readFileSync(new URL("../mobile/app/_layout.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../mobile/src/ui.tsx", import.meta.url), "utf8");
  const locale = readFileSync(new URL("../mobile/src/i18n.tsx", import.meta.url), "utf8");
  assert.match(root, /<LocaleProvider>/);
  assert.match(ui, /<LanguageToggle\s*\/>/);
  assert.match(locale, /SecureStore\.setItemAsync\(KEY, next\)/);
  assert.match(locale, /accessibilityState=\{\{ selected: locale === code \}\}/);
});
