import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('ga4.js','utf8');
const id='G-TEST123456';
function browser({url='https://halainvites.com/?email=private@example.com&code=PRIVATE_TOKEN',storage={},enabled=true,measurementId=id}={}){
 const values=new Map(Object.entries(storage)),scripts=[],cookies=[];
 const document={referrer:'https://www.google.com/search?q=private@example.com',head:{append:s=>scripts.push(s)},createElement:()=>({})};
 Object.defineProperty(document,'cookie',{get:()=> '_ga=fixture; halaSession=keep',set:value=>cookies.push(value)});
 const window={HALA_GA4_CONFIG:{enabled,measurementId}};
 vm.runInNewContext(source,{window,document,location:new URL(url),localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},URL,Date});
 return{window,api:window.HALA_GA4,scripts,cookies,values,commands:()=>Array.from(window.halaGa4DataLayer||[],entry=>Array.from(entry))};
}
const yes={halaAnalyticsConsent:'yes',halaGoogleAnalyticsConsentV1:'yes'};

test('no Google script or commands before consent, including legacy first-party consent',()=>{
 for(const storage of [{},{halaAnalyticsConsent:'yes'},{halaAnalyticsConsent:'no',halaGoogleAnalyticsConsentV1:'yes'}]){
  const b=browser({storage});assert.equal(b.api.track('page_view'),false);assert.equal(b.scripts.length,0);assert.equal(b.commands().length,0);
 }
 assert.equal(browser({storage:{halaAnalyticsConsent:'yes'}}).api.needsDecision(),true);
});

test('Google receives only canonical public paths and allowlisted marketing evidence',()=>{
 const b=browser({storage:yes});
 assert.equal(b.api.track('page_view',{email:'private@example.com',phone:'0501234567',occasion:'PRIVATE_TOKEN'},{utm_source:'google',utm_medium:'organic',utm_campaign:'Private Guest'}),true);
 b.api.track('booking_started',{occasion:'wedding',template:'Private Guest',name:'PRIVATE_TOKEN'});
 assert.equal(b.scripts.length,1);
 assert.equal(b.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id='+id+'&l=halaGa4DataLayer');
 const commands=b.commands(),config=commands.find(c=>c[0]==='config')[2],events=commands.filter(c=>c[0]==='event');
 assert.equal(config.send_page_view,false);assert.equal(config.allow_google_signals,false);assert.equal(config.allow_ad_personalization_signals,false);
 assert.equal(events.length,2);assert.equal(events[0][2].page_location,'https://halainvites.com/');assert.equal(events[0][2].page_referrer,'https://www.google.com/');
 assert.equal(events[0][2].campaign_source,'google');assert.equal(events[1][2].occasion,'wedding');
 assert.doesNotMatch(JSON.stringify(commands),/private@example.com|0501234567|PRIVATE_TOKEN|Private Guest/);
});

test('private portals, booking pages, guest links, previews and unknown pages never initialize GA4',()=>{
 for(const path of ['/guest.html?code=PRIVATE_TOKEN','/i/PRIVATE_TOKEN','/admin.html','/dashboard','/customer.html','/booking.html?id=PRIVATE_TOKEN','/unknown.html']){
  const b=browser({url:'https://halainvites.com'+path,storage:yes});assert.equal(b.api.track('page_view'),false,path);assert.equal(b.scripts.length,0,path);
 }
 for(const url of ['https://deploy-preview-1--noortoona.netlify.app/','http://127.0.0.1:4173/','http://halainvites.com/','https://halainvites.com.evil.test/'])assert.equal(browser({url,storage:yes}).api.track('page_view'),false,url);
});

test('revoking measurement drops queued events, disables GA and clears only GA cookies',()=>{
 const b=browser({storage:yes});b.api.track('page_view');b.api.setConsent(false);
 assert.equal(b.window['ga-disable-'+id],true);assert.equal(b.api.track('booking_started'),false);assert.equal(b.commands().length,0);assert.equal(b.values.get('halaGoogleAnalyticsConsentV1'),'no');
 assert.ok(b.cookies.length>0);assert.ok(b.cookies.every(c=>c.startsWith('_ga=')));assert.ok(!b.cookies.some(c=>c.startsWith('halaSession=')));
});

test('disabled and missing/unissued measurement IDs fail closed',()=>{
 for(const options of [{enabled:false},{measurementId:null},{measurementId:'<script>'}]){
  const b=browser({...options,storage:yes});assert.equal(b.api.track('page_view'),false);assert.equal(b.scripts.length,0);
 }
});

test('private HTML does not load the Google bridge, and marketing pages load config before consent tracking',()=>{
 for(const f of ['admin.html','guest.html','customer.html','partner.html','supervisor.html','dashboard.html','booking.html'])assert.doesNotMatch(readFileSync(f,'utf8'),/src="\/?ga4(?:-config)?\.js"/);
 for(const f of ['index.html',...['wedding','engagement','graduation'].flatMap(s=>[s+'-invitations.html',s+'-invitations-en.html'])]){
  const html=readFileSync(f,'utf8');assert.ok(html.indexOf('/ga4-config.js')<html.indexOf('/ga4.js'));assert.ok(html.indexOf('/ga4.js')<html.indexOf('analytics.js'));
 }
});
