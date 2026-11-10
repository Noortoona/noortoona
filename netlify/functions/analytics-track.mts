import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {analyticsEnvironment,analyticsId,CLIENT_EVENTS,normalizeAttribution,safeMetadata,isPrivateAnalyticsPath} from './_shared/analytics.mjs';
export default async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});if(!isSameOriginRequest(req))return secureJson({ok:false},403);
 if(Number(req.headers.get('content-length')||0)>6000)return secureJson({ok:false},413);
 if(/bot|spider|crawler|headless|curl|wget|python|monitor|preview/i.test(req.headers.get('user-agent')||''))return secureJson({ok:true,ignored:true},202);
 let client:any;try{const b:any=await req.json();if(JSON.stringify(b).length>6000)return secureJson({ok:false},413);if(b.consent!==true)return secureJson({ok:true,ignored:true},202);
 const sid=analyticsId(b.sessionId),visitor=analyticsId(b.visitorId),eid=analyticsId(b.eventId),event=String(b.event||''),path=String(b.path||'/').split(/[?#]/)[0].slice(0,240);
 if(!sid||!eid||!CLIENT_EVENTS.has(event)||!/^\/[a-zA-Z0-9/_\.\-]*$/.test(path))return secureJson({ok:false},400);
 if(isPrivateAnalyticsPath(path))return secureJson({ok:true,ignored:true},202);
 const ua=req.headers.get('user-agent')||'',device=/ipad|tablet/i.test(ua)?'tablet':/mobile|android|iphone|reactnative|expo/i.test(ua)?'mobile':ua?'desktop':'unknown',environment=analyticsEnvironment();
 client=await getDatabase().pool.connect();await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`analytics:${environment}:${sid}`]);
 if((await client.query('SELECT id FROM page_views WHERE event_id=$1 LIMIT 1',[eid])).rows[0]){await client.query('COMMIT');return secureJson({ok:true,duplicate:true});}
 const count=(await client.query("SELECT COUNT(*)::int count FROM page_views WHERE session_id=$1 AND environment=$2 AND created_at>NOW()-INTERVAL '1 minute'",[sid,environment])).rows[0].count;
 if(count>=30){await client.query('ROLLBACK');return secureJson({ok:false,error:'طلبات كثيرة؛ حاول لاحقًا'},429);}
 await client.query('INSERT INTO page_views(id,session_id,event_name,path,metadata,visitor_id,event_id,source,device_type,environment,consent) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9,$10,true)',[crypto.randomUUID(),sid,event,path,JSON.stringify(safeMetadata(b.metadata)),visitor||null,eid,JSON.stringify(normalizeAttribution(b.attribution)),device,environment]);await client.query('COMMIT');return secureJson({ok:true},201);
 }catch{if(client)await client.query('ROLLBACK').catch(()=>{});return secureJson({ok:false},400)}finally{if(client)client.release()}
};
export const config:Config={path:'/api/analytics/track',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:120}};
