(() => {
  'use strict';
  const CONSENT='halaAnalyticsConsent', VISITOR='halaConsentedVisitor', SESSION='halaAnalyticsSession', ATTR='halaArrivalAttribution';
  const allowed=new Set(['page_view','booking_started','occasion_selected','package_viewed','template_selected','price_viewed','contact_started']);
  const uuid=()=>crypto.randomUUID().replaceAll('-','');
  const read=(storage,key)=>{try{return storage.getItem(key)}catch{return null}};
  const write=(storage,key,value)=>{try{storage.setItem(key,value)}catch{}};
  const remove=(storage,key)=>{try{storage.removeItem(key)}catch{}};
  let consent=read(localStorage,CONSENT)==='yes', visitor=consent?read(localStorage,VISITOR)||uuid():'', session={id:uuid(),last:Date.now()}, attribution={};
  try{attribution=JSON.parse(read(sessionStorage,ATTR)||'{}')}catch{}
  const params=new URLSearchParams(location.search),arrival={};
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=params.get(key);if(value)arrival[key]=value.slice(0,120)}
  const ref=params.get('ref');if(ref&&/^[a-zA-Z0-9_-]{4,24}$/.test(ref))arrival.referralCode=ref.toUpperCase();
  try{if(document.referrer&&new URL(document.referrer).origin!==location.origin)arrival.referrer=new URL(document.referrer).hostname}catch{}
  if(Object.keys(arrival).length){attribution=arrival;write(sessionStorage,ATTR,JSON.stringify(attribution))}
  if(consent){write(localStorage,VISITOR,visitor);try{const prior=JSON.parse(read(sessionStorage,SESSION)||'null');if(prior&&Date.now()-prior.last<30*60*1000)session=prior}catch{}}
  function currentSession(){if(Date.now()-session.last>30*60*1000)session={id:uuid(),last:Date.now()};session.last=Date.now();if(consent)write(sessionStorage,SESSION,JSON.stringify(session));return session.id}
  function context(){return{attribution:{...attribution},sessionId:currentSession(),visitorId:consent?visitor:undefined,analyticsConsent:consent}}
  async function track(event,metadata={}){
    if(!consent||!allowed.has(event))return false;
    const safe={};for(const key of ['occasion','packageCode','template','service'])if(typeof metadata[key]==='string')safe[key]=metadata[key].slice(0,100);
    try{const response=await fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...context(),consent:true,event,eventId:uuid(),path:location.pathname,metadata:safe}),keepalive:true});return response.ok}catch{return false}
  }
  function setConsent(value){consent=value===true;write(localStorage,CONSENT,consent?'yes':'no');if(consent){visitor=read(localStorage,VISITOR)||uuid();write(localStorage,VISITOR,visitor);track('page_view')}else{visitor='';remove(localStorage,VISITOR);remove(sessionStorage,SESSION)}document.getElementById('halaAnalyticsConsent')?.remove();}
  function showConsent(){
    document.getElementById('halaAnalyticsConsent')?.remove();const el=document.createElement('section');el.id='halaAnalyticsConsent';el.setAttribute('role','region');el.setAttribute('aria-label','خيارات الخصوصية');el.dir='rtl';
    el.style.cssText='position:fixed;bottom:16px;inset-inline:16px;max-width:620px;margin:auto;z-index:9999;padding:18px;border:1px solid #D3A447;border-radius:18px;background:#11151D;color:#FBF7EF;box-shadow:0 10px 40px #0008;font:14px/1.7 sans-serif';
    const copy=document.createElement('p');copy.textContent='هل تسمح بقياس زيارتك وتفاعلاتك لتحسين تجربة هلا؟ القياس اختياري، ولا يمنع الرفض إكمال الحجز. نستخدم معرّف متصفح تقديريًا دون إرسال بيانات التواصل للإحصائيات.';el.append(copy);
    for(const [text,value] of [['السماح بالقياس',true],['متابعة دون قياس',false]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.style.cssText='margin:4px;padding:10px 16px;border-radius:10px;border:1px solid #D3A447;background:#11151D;color:#F0D08A;cursor:pointer';button.addEventListener('click',()=>setConsent(value));el.append(button)}document.body.append(el);
  }
  window.HALA_ANALYTICS={track,context,setConsent,getConsent:()=>consent,showConsent};
  function boot(){if(read(localStorage,CONSENT)===null)showConsent();else if(consent)track('page_view');const button=document.createElement('button');button.type='button';button.textContent='تفضيلات الخصوصية';button.className='auth-link';button.addEventListener('click',showConsent);(document.querySelector('footer')||document.body).append(button)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
