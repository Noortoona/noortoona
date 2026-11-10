import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=f=>readFileSync(f,'utf8');
const slugs=['wedding-invitations','engagement-invitations','graduation-invitations'];

test('Arabic and English guides expose reciprocal, self-canonical language alternatives',()=>{
 for(const slug of slugs){
  for(const file of [slug+'.html',slug+'-en.html']){
   const html=read(file);
   assert.ok(html.includes('rel="canonical" href="https://halainvites.com/'+file+'"'));
   for(const [lang,target] of [['ar-SA',slug+'.html'],['en-SA',slug+'-en.html'],['x-default',slug+'.html']])assert.ok(html.includes('hreflang="'+lang+'" href="https://halainvites.com/'+target+'"'));
   assert.ok(read('sitemap.xml').includes('<loc>https://halainvites.com/'+file+'</loc>'));
   assert.ok(read('scripts/build-static.mjs').includes("'"+file+"'"));
  }
  const en=read(slug+'-en.html');
  assert.match(en,/<html lang="en" dir="ltr">/);
  assert.ok(en.includes('href="/'+slug+'.html"'));
  assert.ok(en.includes('<script src="/analytics.js"></script>'));
  assert.ok(en.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').split(/\s+/).length>300,'useful translated content');
 }
});

test('official social identities and contact email agree across public pages',()=>{
 for(const file of ['index.html',...slugs.flatMap(s=>[s+'.html',s+'-en.html'])]){
  const html=read(file);
  for(const url of ['https://www.instagram.com/halainvites/','https://www.tiktok.com/@halainvites'])assert.ok(html.includes('href="'+url+'" target="_blank" rel="noopener noreferrer"'));
  assert.ok(html.includes('mailto:hello@halainvites.com'));
  const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  const org=schema['@graph'].find(n=>n['@type']==='Organization');
  assert.deepEqual(org.sameAs,['https://www.instagram.com/halainvites/','https://www.tiktok.com/@halainvites']);
  assert.equal(org.email,'hello@halainvites.com');
  assert.ok(!JSON.stringify(schema).includes('aggregateRating'));
 }
});

test('private HTML pages and invitation aliases carry HTTP noindex headers',()=>{
 const config=read('netlify.toml');
 for(const path of ['/i/*',...['admin','customer','dashboard','guest','partner','supervisor','booking'].flatMap(n=>['/'+n,'/'+n+'.html'])]){
  const rule=config.split('[[headers]]').find(block=>block.includes('for = "'+path+'"'));
  assert.ok(rule?.includes('X-Robots-Tag = "noindex, nofollow, noarchive"'),path);
 }
});
