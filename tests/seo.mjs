import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = filename => readFileSync(resolve(filename),"utf8");
const home=read("index.html");
const expected=[
  {file:"wedding-invitations.html",word:"دعوات زواج إلكترونية",slug:"wedding-invitations"},
  {file:"engagement-invitations.html",word:"دعوات ملكة",slug:"engagement-invitations"},
  {file:"graduation-invitations.html",word:"دعوات تخرج",slug:"graduation-invitations"}
];

test("SEO improvements retain original HALA visual homepage and booking",()=>{
 assert.match(home,/<section id="home" class="hero">/);
 assert.match(home,/<h1>لحظتك \.\.<br><span>تبدأ بهلا<\/span><\/h1>/);
 assert.match(home,/<div class="hero-scene"/);
 assert.match(home,/id="builderModal"/);
 assert.doesNotMatch(home,/home-luxury\.css|hala-hero-photo\.webp|luxury-title/);
 assert.match(home,/name="robots" content="index,follow,max-image-preview:large"/);
 assert.match(home,/rel="canonical" href="https:\/\/halainvites\.com\/"/);
 assert.match(home,/<title>دعوات إلكترونية فاخرة للزواج والمناسبات \| هلا HALA<\/title>/);
 assert.match(home,/type="application\/ld\+json"/);
 const schemaText=home.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
 assert.ok(schemaText);
 const schema=JSON.parse(schemaText);
 assert.equal(schema["@context"],"https://schema.org");
 assert.ok(schema["@graph"].some(x=>x["@type"]==="Organization"));
 assert.ok(schema["@graph"].some(x=>x["@type"]==="WebSite"));
});

test("each occasion landing page is unique, canonical, useful and linked",()=>{
 const titles=new Set();
 for(const p of expected){
   const body=read(p.file);
   assert.match(body,/<html lang="ar" dir="rtl">/);
   assert.ok(body.includes('<link rel="canonical" href="https://halainvites.com/'+p.file+'" />'));
   assert.ok(body.includes(p.word));
   assert.ok(body.includes('href="/#home"'));
   assert.ok(body.includes('href="/#templates"'));
   assert.ok(body.includes('<h1>'));
   assert.ok(body.includes('<h2>'));
   assert.ok(body.includes('<details>'));
   assert.ok(body.includes('name="robots" content="index,follow,max-image-preview:large"'));
   const title=body.match(/<title>([^<]+)<\/title>/)?.[1];
   assert.ok(title);
   assert.ok(!titles.has(title));
   titles.add(title);
   assert.ok(home.includes('href="/'+p.file+'"'),"internal link "+p.file);
   const s=JSON.parse(body.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
   assert.ok(s["@graph"].some(x=>x["@type"]==="BreadcrumbList"));
 }
});

test("sitemap, robots and static publishing inventory are aligned",()=>{
 const sitemap=read("sitemap.xml");
 const robots=read("robots.txt");
 const build=read("scripts/build-static.mjs");
 assert.match(robots,/Sitemap: https:\/\/halainvites\.com\/sitemap\.xml/);
 for(const url of ["https://halainvites.com/",...expected.map(p=>"https://halainvites.com/"+p.file)]){
   assert.ok(sitemap.includes("<loc>"+url+"</loc>"),url);
 }
 assert.equal((sitemap.match(/<url>/g)||[]).length,7);
 for(const f of ["seo-pages.css","robots.txt","sitemap.xml",...expected.map(x=>x.file)]){
   assert.ok(build.includes("'"+f+"'"),"static builder must deploy "+f);
 }
});

test("protected application and personal guest pages are not indexable",()=>{
 for(const f of ["admin.html","customer.html","dashboard.html","guest.html","partner.html","supervisor.html","booking.html"]){
   const html=read(f);
   assert.match(html,/<meta name="robots" content="noindex,nofollow"/,f);
 }
});
