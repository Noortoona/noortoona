import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const read = file => readFileSync(resolve(file), "utf8");
const page = read("index.html");

test("Arabic homepage uses meaningful SEO metadata and consistent canonical", () => {
  assert.match(page, /<html lang="ar" dir="rtl">/);
  assert.match(page, /<title>دعوات إلكترونية فاخرة للزواج والمناسبات \| هلا HALA<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]*دعوة زواج إلكترونية[^"]*" \/>/);
  assert.match(page, /rel="canonical" href="https:\/\/halainvites\.com\/"/);
  assert.match(page, /"@type":"WebSite"/);
  assert.match(page, /"@type":"Organization"/);
  assert.doesNotMatch(page, /"@type":"AggregateRating"/);
  assert.doesNotMatch(page, /"@type":"SearchAction"/);
});

test("approved brand wordmark and real interactive invitation CTA are used", () => {
  assert.match(page, /class="hero hero-luxury"/);
  assert.match(page, /<h1 class="luxury-title">/);
  assert.match(page, /hala-hero-wordmark\.svg/);
  assert.match(page, /class="gold-btn" data-start>ابدأ دعوتك الآن/);
  assert.match(page, /href="#templates">استعرض القوالب/);
  assert.match(page, /تصميم دعوات زواج إلكترونية ودعوات ملكة وتخرج بأسلوب فاخر/);
  assert.match(page, /id="builderModal"/);
  assert.match(page, /src="\/i18n\.js"/);
});

test("optimized approved photo and actual approved SVG brand assets exist", () => {
  const webp = readFileSync("assets/brand/hala-hero-photo.webp");
  assert.ok(webp.length > 5000 && webp.length < 100000);
  assert.equal(webp.toString("ascii", 0, 4), "RIFF");
  assert.equal(webp.toString("ascii", 8, 12), "WEBP");
  assert.match(read("assets/brand/hala-hero-wordmark.svg"), /viewBox="384 207 444 207"/);
  assert.match(read("home-luxury.css"), /url\("\/assets\/brand\/hala-hero-photo\.webp"\)/);
});

test("sitemap and robots instructions point to real canonical domain", () => {
  assert.match(read("robots.txt"), /Sitemap: https:\/\/halainvites\.com\/sitemap\.xml/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/halainvites\.com\/<\/loc>/);
  const publicFiles=read("scripts/build-static.mjs");
  for(const f of ["home-luxury.css","robots.txt","sitemap.xml"]) assert.ok(publicFiles.includes("'"+f+"'"),f);
});
