// Local-only integration harness. Never included in the public build or remote DB.
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {registerHooks} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
registerHooks({resolve(name,context,next){if(name==='@netlify/database')return{url:'data:text/javascript,export function getDatabase(){return globalThis.__BROWSER_DB__}',shortCircuit:true};return next(name,context);}});
const pg=new PGlite();let tail=Promise.resolve();
async function lock(){const before=tail;let release;tail=new Promise(r=>release=r);await before;return release;}
const db={sql:async(parts,...args)=>{const release=await lock();try{return(await pg.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),args)).rows;}finally{release();}},pool:{connect:async()=>{const release=await lock();return{query:(s,v)=>pg.query(s,v),release};}}};
globalThis.__BROWSER_DB__=db;
globalThis.Netlify={env:{get:key=>({CONTEXT:'deploy-preview',DEPLOY_ID:'local-browser-test'})[key]}};
for(const name of(await readdir(new URL('../netlify/database/migrations/',import.meta.url))).sort())await pg.exec(await readFile(new URL('../netlify/database/migrations/'+name+'/migration.sql',import.meta.url),'utf8'));
await pg.exec("INSERT INTO users(id,name,phone,role) VALUES('browser-admin','اختبار إدارة معزول','966501234567','admin'),('browser-staff','اختبار خدمة عملاء معزول','966501234568','customer_service')");
const {createSession}=await import('../netlify/functions/_shared/auth.mjs');
const admin=(await createSession('browser-admin')).token,staff=(await createSession('browser-staff')).token;
const handlers=new Map();
for(const name of(await readdir(new URL('../netlify/functions/',import.meta.url))).filter(n=>n.endsWith('.mts'))){const mod=await import('../netlify/functions/'+name);if(typeof mod.config?.path==='string')handlers.set(mod.config.path,mod.default);}
const root=resolve('dist'),port=Number(process.env.PLAYWRIGHT_TEST_PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(url.pathname==='/__test/state'){
   const r=await db.sql`SELECT id,booking_number,booking_status,payment_status,total_amount,attribution FROM bookings ORDER BY created_at DESC`;
   res.setHeader('content-type','application/json');res.end(JSON.stringify({bookings:r,admin,staff}));return;
  }
  if(handlers.has(url.pathname)){
   const chunks=[];for await(const b of req)chunks.push(b);const body=Buffer.concat(chunks);
   const response=await handlers.get(url.pathname)(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}: {})}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';else if(!extname(pathname))pathname+='.html';
  const file=resolve(root,'.'+pathname);if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  const content=await readFile(file);res.setHeader('content-type',types[extname(file)]||'application/octet-stream');res.end(content);
 }catch(e){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({error:'Local test route failed'}));}
}).listen(port,'127.0.0.1',()=>console.log('Isolated PostgreSQL browser fixture ready on '+port));
