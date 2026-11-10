export const CLIENT_EVENTS=new Set(['page_view','booking_started','occasion_selected','package_viewed','template_selected','price_viewed','contact_started','invitation_cta_clicked']);
export const isPrivateAnalyticsPath=path=>/^\/(?:i(?:\/|$)|(?:guest|dashboard|admin|customer|partner|supervisor)(?:\.html|\/|$))/.test(path);
export const SERVER_EVENTS=new Set(['prebooking_completed','contact_requested','launch_subscribed']);
export const analyticsId=value=>/^[A-Za-z0-9_-]{12,80}$/.test(String(value||''))?String(value):'';
const clean=(value,max=120)=>String(value||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
export function analyticsEnvironment(){const get=key=>typeof Netlify!=='undefined'?Netlify.env.get(key):'';return get('CONTEXT')==='production'?'production':`preview:${clean(get('BRANCH')||get('DEPLOY_ID')||get('CONTEXT')||'development',100)}`;}
export function normalizeAttribution(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))return{source:'direct_or_unknown'};
 const result={};for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=clean(input[key]);if(value&&!/[<>@\n]/.test(value)&&!/\b(?:\+?966|05)\d{8,9}\b/.test(value))result[key]=value;}
 const ref=clean(input.referrer||input.referrer_host,300);if(ref){try{result.referrer_host=new URL(ref.includes('://')?ref:`https://${ref}`).hostname.toLowerCase().slice(0,160)}catch{}}
 const code=clean(input.referralCode||input.referral_code,24).toUpperCase();if(/^[A-Z0-9_-]{4,24}$/.test(code))result.referral_code=code;
 const evidence=`${result.utm_source||''} ${result.referrer_host||''}`.toLowerCase();result.source=/tiktok|(^|\s)tt(\s|$)/.test(evidence)?'tiktok':/snapchat|(^|\s)snap(\s|$)/.test(evidence)?'snapchat':/instagram/.test(evidence)?'instagram':/google/.test(evidence)?'google':evidence.trim()?'other':'direct_or_unknown';return result;
}
export function safeMetadata(input={}){const result={};if(!input||typeof input!=='object'||Array.isArray(input))return result;for(const key of ['occasion','packageCode','template','service']){const value=clean(input[key],100);if(value&&!/[<>@]/.test(value)&&!/\d{7}/.test(value))result[key]=value;}return result;}
export async function recordServerInterest(client,{event,entityId,sessionId,visitorId,attribution={}}){
 if(!SERVER_EVENTS.has(event))throw Error('INVALID_SERVER_EVENT');const sid=analyticsId(sessionId);if(!sid)return false;const environment=analyticsEnvironment();
 // A server completion fact never bypasses the session's analytics consent.
 const consent=(await client.query('SELECT visitor_id FROM page_views WHERE session_id=$1 AND environment=$2 AND consent=true LIMIT 1',[sid,environment])).rows[0];if(!consent)return false;
 await client.query("INSERT INTO page_views(id,session_id,event_name,path,metadata,visitor_id,event_id,source,device_type,environment,consent) VALUES($1,$2,$3,'/booking','{}'::jsonb,$4,$5,$6::jsonb,'unknown',$7,true) ON CONFLICT(event_id) WHERE event_id IS NOT NULL DO NOTHING",[crypto.randomUUID(),sid,event,consent.visitor_id||null,`${event}:${entityId}`,JSON.stringify(normalizeAttribution(attribution)),environment]);return true;
}
export async function recordBookingCompletion(client,booking){return recordServerInterest(client,{event:'prebooking_completed',entityId:booking.id,sessionId:booking.session_id,visitorId:booking.visitor_id,attribution:booking.attribution});}
export const sanitizeAttribution=normalizeAttribution;
