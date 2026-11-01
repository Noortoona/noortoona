import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../invitation-renderer.js', import.meta.url), 'utf8');
const sandbox = { window: {}, URL };
vm.runInNewContext(renderer, sandbox);
const N = sandbox.window.NOORTOONA;

test('custom images cannot escape the style attribute or execute scripts', () => {
  for (const image of ['x" onpointerover="alert(1)', 'javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', '//evil.test/a.png']) {
    assert.equal(N.safeImageUrl(image), '');
    const html = N.canvas({ design: { image } });
    assert.doesNotMatch(html, /onpointerover|onload|javascript:|evil\.test/);
  }
  assert.equal(N.safeImageUrl('data:image/jpeg;base64,YWJj'), 'data:image/jpeg;base64,YWJj');
  const html = N.canvas({ design: { image: 'https://example.test/image.png?q=" onclick="oops' } });
  assert.doesNotMatch(html, /" onclick=/);
  assert.match(html, /%22/);
});

test('Google Maps opens location and directions without collecting location', () => {
  const links = N.mapsLinks('', 'قاعة الرياض & مدخل 2');
  assert.equal(new URL(links.map).searchParams.get('query'), 'قاعة الرياض & مدخل 2');
  assert.equal(new URL(links.directions).searchParams.get('destination'), 'قاعة الرياض & مدخل 2');
  assert.equal(N.mapsLinks('https://maps.app.goo.gl/Example', '').map, 'https://maps.app.goo.gl/Example');
  assert.equal(N.mapsLinks('javascript:alert(1)', '').map, '');
  assert.equal(N.mapsLinks('https://maps.google.com.attacker.test/a', '').map, '');
  assert.equal(N.mapsLinks('https://name:pass@maps.google.com/a', '').map, '');
});

test('invitation audio is embedded locally and rejects executable/external sources', () => {
  assert.equal(N.safeAudioUrl('data:audio/mpeg;base64,YWJj'), 'data:audio/mpeg;base64,YWJj');
  for (const audio of ['javascript:alert(1)', 'https://tracker.test/a.mp3', 'data:text/html;base64,YWJj']) assert.equal(N.safeAudioUrl(audio), '');
});

test('QR is generated locally from an invitation code with no network request', async () => {
  const qr = { window: {} };
  vm.runInNewContext(await readFile(new URL('../assets/vendor/hala-qr.js', import.meta.url), 'utf8'), qr);
  const data = qr.window.HALA_QR.dataUrl('AB12CD34');
  assert.match(data, /^data:image\/svg\+xml;charset=utf-8,/);
  const svg = decodeURIComponent(data.split(',').slice(1).join(','));
  assert.match(svg, /viewBox="0 0 29 29"/);
  assert.match(svg, /M4,4h1v1h-1z/);
  assert.doesNotMatch(svg, /fetch|https?:\/\/(?!www\.w3\.org)|AB12CD34/);
  assert.throws(() => qr.window.HALA_QR.dataUrl('<img>'));
  assert.equal(data, qr.window.HALA_QR.dataUrl('AB12CD34'));
});

test('closing phone OTP resolves the pending create/login operation', async () => {
  const elements = new Map();
  const button = () => ({ onclick: null });
  const close = button();
  const modal = { dataset: {}, classList: { add() {}, remove() {} }, querySelectorAll: () => [close], querySelector: selector => {
    if (!elements.has(selector)) elements.set(selector, { ...button(), classList: { toggle() {} }, focus() {} });
    return elements.get(selector);
  } };
  const context = {
    window: {}, URL, URLSearchParams, location: { search: '', pathname: '/' }, crypto: { randomUUID: () => 'synthetic-visitor' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: { referrer: '', getElementById: () => modal, querySelectorAll: () => [], body: { appendChild() {} } },
    fetch: async () => ({ ok: true, json: async () => ({}) }), setTimeout: () => 0,
  };
  // Allow the production modal initializer to register handlers, using a minimal DOM fixture.
  context.document.getElementById = () => elements.has('created') ? modal : null;
  context.document.createElement = () => { elements.set('created', true); return modal; };
  vm.runInNewContext(await readFile(new URL('../account.js', import.meta.url), 'utf8'), context);
  const waiting = context.window.HALA_AUTH.ensureLogin('create');
  await Promise.resolve(); await Promise.resolve();
  close.onclick();
  assert.equal(await waiting, null);
});

 test('same template name uses the correct occasion artwork', () => {
  assert.notEqual(N.templateByName('مخمل ملكي', 'wedding').position, N.templateByName('مخمل ملكي', 'milkah').position);
  const html = N.canvas({occasionKey:'milkah',template:'مخمل ملكي',name1:'أحمد',name2:'سارة'});
  assert.match(html,/100% 75%/);
  assert.match(html,/أحمد و سارة/);
});

test('public builder replaces fallback prices, template visibility and service text from the actual catalog API response', async () => {
  const prices={innerHTML:''}, templates={innerHTML:''}, services={innerHTML:''};
  const elements={ '#builderModal':{classList:{contains:()=>false}}, '#builderBody':{}, '#nextBtn':{}, '#prevBtn':{}, '#priceGrid':prices, '#templateGrid':templates, '#services .service-grid':services };
  const fixture={version:1,packages:[{code:'hala_basic',name:'هلا الأساسية',amount:16900,guestLimit:120,currency:'SAR'},{code:'hala_plus',name:'هلا بلس',amount:35900,guestLimit:260,currency:'SAR'},{code:'hala_premium',name:'هلا بريميوم',amount:70900,guestLimit:510,currency:'SAR'}],hiddenTemplateKeys:['wedding:ليلة كحلية'],services:[{id:'test',name:'خدمة خاصة',description:'<script>unsafe</script>',enabled:true}]};
  const requested=[];
  const context={window:{},URL,URLSearchParams,location:{search:''},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:selector=>elements[selector]||null,querySelectorAll:()=>[],addEventListener(){}},fetch:async path=>{requested.push(path);return {ok:true,json:async()=>fixture}},setTimeout,clearTimeout};
  vm.runInNewContext(renderer,context);
  vm.runInNewContext(await readFile(new URL('../app.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requested,['/api/catalog']);
  assert.match(prices.innerHTML,/>(?:169|١٦٩)<small>/);
  assert.match(prices.innerHTML,/حتى 120 ضيف/);
  assert.doesNotMatch(templates.innerHTML,/ليلة كحلية/);
  assert.match(services.innerHTML,/خدمة خاصة/);
  assert.match(services.innerHTML,/&lt;script&gt;/);
  assert.doesNotMatch(services.innerHTML,/<script>/);
});

test('admin catalog submits its revision and reloads rather than overwriting a concurrent edit', async () => {
  const notice={textContent:''},button={disabled:false},calls=[];
  const elements={adminRoot:{innerHTML:''},logoutBtn:{},catalogResult:notice};
  let conflicts=false,reloads=0;
  const context={document:{getElementById:id=>elements[id]||null,createElement:()=>({}),body:{appendChild(){}}},fetch:async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return Response.json(conflicts?{error:'stale'}:{ok:true},{status:conflicts?409:200})},localStorage:{},window:{},location:{},alert(){}};
  vm.runInNewContext(await readFile(new URL('../admin.js',import.meta.url),'utf8'),context);
  vm.runInNewContext('s={token:"fixture-token"};catalogRevision=4;',context);
  context.load=async()=>{reloads++};
  await context.saveCatalog({packages:[{code:'hala_basic',amount:16900,guestLimit:120}]},{querySelector:()=>button});
  assert.equal(calls[0].path,'/api/admin/catalog');
  assert.equal(calls[0].body.expectedRevision,4);
  assert.equal(calls[0].body.packages[0].amount,16900);
  assert.match(notice.textContent,/تم حفظ/);
  conflicts=true;
  await context.saveCatalog({hiddenTemplateKeys:[]},{querySelector:()=>button});
  assert.equal(calls.length,2);
  assert.equal(reloads,2);
  assert.match(notice.textContent,/تغيرت الإعدادات/);
});

test('premium fallback, required supervisor preference and promotional references preserve the server contract', async () => {
  async function appFor(packages){
    const priceGrid={innerHTML:''},elements={'#builderModal':{classList:{contains:()=>false}},'#builderBody':{},'#nextBtn':{},'#prevBtn':{},'#priceGrid':priceGrid};
    const fixture={version:1,packages,hiddenTemplateKeys:[],services:[]};
    const context={window:{},URL,URLSearchParams,location:{search:''},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:selector=>elements[selector]||null,querySelectorAll:()=>[],addEventListener(){}},fetch:async()=>({ok:true,json:async()=>fixture}),setTimeout,clearTimeout};
    vm.runInNewContext(renderer,context);vm.runInNewContext(await readFile(new URL('../app.js',import.meta.url),'utf8'),context);
    await new Promise(resolve=>setImmediate(resolve));
    return {context,priceGrid};
  }
  const packages=[{code:'hala_basic',name:'هلا الأساسية',amount:44900,amountSar:449,guestLimit:100,currency:'SAR',referenceAmountSar:999},{code:'hala_plus',name:'هلا بلس',amount:109900,guestLimit:250,currency:'SAR'},{code:'hala_premium',name:'هلا بريميوم',amount:179900,guestLimit:500,currency:'SAR'}];
  const initial=await appFor(packages);
  assert.doesNotMatch(initial.priceGrid.innerHTML,/<del>/);
  assert.match(initial.priceGrid.innerHTML,/٤٤٩|449/);
  assert.match(vm.runInNewContext('state.step=7;state.requestSupervisor=true;validate()',initial.context),/اختر مشرفًا أو مشرفة/);
  assert.equal(vm.runInNewContext('state.supervisorPreference="female";validate()',initial.context),'');
  const send=vm.runInNewContext('renderSend()',initial.context);
  assert.match(send,/599|٥٩٩/);assert.match(send,/value="female" checked/);
  const verified=await appFor(packages.map(p=>p.code==='hala_basic'?{...p,promoLicenseId:'fixture-verified-license'}:p));
  assert.match(verified.priceGrid.innerHTML,/<del>/);
  const noSaving=await appFor(packages.map(p=>p.code==='hala_basic'?{...p,referenceAmountSar:300,promoLicenseId:'fixture-verified-license'}:p));
  assert.doesNotMatch(noSaving.priceGrid.innerHTML,/<del>/);
});
