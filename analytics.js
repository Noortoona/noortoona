(() => {
  'use strict';
  const CONSENT='halaAnalyticsConsent', VISITOR='halaConsentedVisitor', SESSION='halaAnalyticsSession', ATTR='halaArrivalAttribution';
  const allowed=new Set(['page_view','booking_started','occasion_selected','package_viewed','template_selected','price_viewed','contact_started','invitation_cta_clicked']);
  const privatePage=/^\/(?:i(?:\/|$)|(?:guest|dashboard|admin|customer|partner|supervisor)(?:\.html|\/|$))/;
  const uuid=()=>crypto.randomUUID().replaceAll('-','');
  const read=(storage,key)=>{try{return storage.getItem(key)}catch{return null}};
  const write=(storage,key,value)=>{try{storage.setItem(key,value)}catch{}};
  const remove=(storage,key)=>{try{storage.removeItem(key)}catch{}};
  const marketingValue=value=>typeof value==='string'&&!/[<>@\n]/.test(value)&&!/\d{7}/.test(value)?value.trim().slice(0,120):'';
  let consent=read(localStorage,CONSENT)==='yes', visitor=consent?read(localStorage,VISITOR)||uuid():'', session={id:uuid(),last:Date.now()}, attribution={};
  try{attribution=JSON.parse(read(sessionStorage,ATTR)||'{}')}catch{}
  const storedAttribution=attribution;attribution={};
  if(storedAttribution&&typeof storedAttribution==='object')for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','referralCode','referrer']){const value=marketingValue(storedAttribution[key]);if(value)attribution[key]=value}
  const params=new URLSearchParams(location.search),arrival={};
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=marketingValue(params.get(key));if(value)arrival[key]=value}
  const ref=params.get('ref');if(ref&&/^[a-zA-Z0-9_-]{4,24}$/.test(ref))arrival.referralCode=ref.toUpperCase();
  try{if(document.referrer&&new URL(document.referrer).origin!==location.origin)arrival.referrer=new URL(document.referrer).hostname}catch{}
  if(Object.keys(arrival).length){attribution=arrival;write(sessionStorage,ATTR,JSON.stringify(attribution))}
  if(consent){write(localStorage,VISITOR,visitor);try{const prior=JSON.parse(read(sessionStorage,SESSION)||'null');if(prior&&Date.now()-prior.last<30*60*1000)session=prior}catch{}}
  function currentSession(){if(Date.now()-session.last>30*60*1000)session={id:uuid(),last:Date.now()};session.last=Date.now();if(consent)write(sessionStorage,SESSION,JSON.stringify(session));return session.id}
  function context(){return{attribution:{...attribution},sessionId:currentSession(),visitorId:consent?visitor:undefined,analyticsConsent:consent}}
  async function track(event,metadata={}){
    if(!consent||!allowed.has(event)||privatePage.test(location.pathname))return false;
    const safe={};for(const key of ['occasion','packageCode','template','service'])if(typeof metadata[key]==='string'&&!/[<>@]/.test(metadata[key])&&!/\d{7}/.test(metadata[key]))safe[key]=metadata[key].slice(0,100);
    try{const response=await fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...context(),consent:true,event,eventId:uuid(),path:location.pathname,metadata:safe}),keepalive:true});return response.ok}catch{return false}
  }
  function setConsent(value){consent=value===true;write(localStorage,CONSENT,consent?'yes':'no');if(consent){visitor=read(localStorage,VISITOR)||uuid();write(localStorage,VISITOR,visitor);track('page_view')}else{visitor='';remove(localStorage,VISITOR);remove(sessionStorage,SESSION)}document.getElementById('halaAnalyticsConsent')?.remove();}
  function showConsent(){
    const english=document.documentElement.lang==='en';
    document.getElementById('halaAnalyticsConsent')?.remove();const el=document.createElement('section');el.id='halaAnalyticsConsent';el.setAttribute('role','region');el.setAttribute('aria-label',english?'Privacy choices':'خيارات الخصوصية');el.dir=english?'ltr':'rtl';
    el.style.cssText='position:fixed;bottom:16px;inset-inline:16px;max-width:620px;margin:auto;z-index:9999;padding:18px;border:1px solid #D3A447;border-radius:18px;background:#11151D;color:#FBF7EF;box-shadow:0 10px 40px #0008;font:14px/1.7 sans-serif';
    const copy=document.createElement('p');copy.textContent=english?'May we measure your visits and interactions to improve HALA? Measurement is optional and declining does not prevent booking. We use an estimated browser identifier without sending contact details to analytics.':'هل تسمح بقياس زيارتك وتفاعلاتك لتحسين تجربة هلا؟ القياس اختياري، ولا يمنع الرفض إكمال الحجز. نستخدم معرّف متصفح تقديريًا دون إرسال بيانات التواصل للإحصائيات.';el.append(copy);
    const choices=english?[['Allow measurement',true],['Continue without measurement',false]]:[['السماح بالقياس',true],['متابعة دون قياس',false]];
    for(const [text,value] of choices){const button=document.createElement('button');button.type='button';button.textContent=text;button.style.cssText='margin:4px;padding:10px 16px;border-radius:10px;border:1px solid #D3A447;background:#11151D;color:#F0D08A;cursor:pointer';button.addEventListener('click',()=>setConsent(value));el.append(button)}document.body.append(el);
  }
  window.HALA_ANALYTICS={track,context,setConsent,getConsent:()=>consent,showConsent};
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-invitation-cta]');
    if(link&&['wedding','milkah','graduation'].includes(link.dataset.invitationCta))track('invitation_cta_clicked',{occasion:link.dataset.invitationCta,service:'invitation_builder'});
  });
  function boot(){if(read(localStorage,CONSENT)===null)showConsent();else if(consent)track('page_view');const button=document.createElement('button');button.type='button';button.textContent=document.documentElement.lang==='en'?'Privacy preferences':'تفضيلات الخصوصية';button.className='auth-link';button.addEventListener('click',showConsent);(document.querySelector('footer')||document.body).append(button)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
