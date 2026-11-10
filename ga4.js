(() => {
  'use strict';
  const config=window.HALA_GA4_CONFIG||{},id=config.measurementId;
  const consentKey='halaGoogleAnalyticsConsentV1';
  const pages=new Map([
    ['/','HALA | هلا'],
    ['/wedding-invitations.html','HALA Wedding Invitations'],
    ['/engagement-invitations.html','HALA Milkah Invitations'],
    ['/graduation-invitations.html','HALA Graduation Invitations'],
    ['/wedding-invitations-en.html','HALA Digital Wedding Invitations'],
    ['/engagement-invitations-en.html','HALA Digital Milkah Invitations'],
    ['/graduation-invitations-en.html','HALA Digital Graduation Invitations']
  ]);
  const rawPath=location.pathname;
  const path=rawPath==='/index.html'?'/':pages.has(rawPath)?rawPath:pages.has(rawPath+'.html')?rawPath+'.html':rawPath;
  const eligible=config.enabled===true&&/^G-[A-Z0-9]{6,20}$/.test(id||'')&&location.protocol==='https:'&&['halainvites.com','www.halainvites.com'].includes(location.hostname)&&pages.has(path);
  const events=new Set(['page_view','invitation_cta_clicked','booking_started','occasion_selected','package_viewed','template_selected','price_viewed','contact_started','booking_request_completed','lead_request_completed']);
  const read=key=>{try{return localStorage.getItem(key)}catch{return null}};
  const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  let granted=read(consentKey)==='yes'&&read('halaAnalyticsConsent')==='yes',configured=false,loaderStarted=false;
  function tag(){window.halaGa4DataLayer.push(arguments)}
  function referrer(){
    try{const url=new URL(document.referrer);return /(^|\.)(google\.[a-z.]+|bing.com|duckduckgo.com|instagram.com|tiktok.com|snapchat.com|facebook.com)$/.test(url.hostname)?url.origin+'/':''}catch{return ''}
  }
  function initialize(){
    if(!eligible||!granted)return false;
    window['ga-disable-'+id]=false;
    if(configured)return true;
    window.halaGa4DataLayer=window.halaGa4DataLayer||[];
    tag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    tag('js',new Date());
    tag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
      page_location:'https://halainvites.com'+path,page_title:pages.get(path),page_referrer:referrer(),cookie_flags:'SameSite=Lax;Secure'});
    configured=true;
    if(!loaderStarted){
      const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id)+'&l=halaGa4DataLayer';
      script.referrerPolicy='origin';script.onerror=()=>{configured=false};document.head.append(script);loaderStarted=true;
    }
    return true;
  }
  function setConsent(value){
    granted=value===true;write(consentKey,granted?'yes':'no');
    if(!granted){
      if(eligible)window['ga-disable-'+id]=true;
      configured=false;
      if(window.halaGa4DataLayer)window.halaGa4DataLayer.length=0;
      // Clear only GA cookies. Do not touch login, booking or other site cookies.
      for(const item of document.cookie.split(';')){
        const name=item.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(name))continue;
        for(const domain of ['',location.hostname,'.halainvites.com'])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');
      }
    }
  }
  function track(event,metadata={},attribution={}){
    if(!events.has(event)||!eligible||!granted)return false;
    try{
      if(!initialize())return false;
      const params={send_to:id,page_location:'https://halainvites.com'+path,page_title:pages.get(path),page_referrer:referrer()};
      if(['wedding','milkah','engagement','graduation','newborn','birthday','meeting','conference','opening','honoring','official','national','condolence','activity','custom'].includes(metadata.occasion))params.occasion=metadata.occasion;
      if(['hala_basic','hala_plus','hala_premium'].includes(metadata.packageCode))params.package_code=metadata.packageCode;
      if(['google','instagram','tiktok','snapchat','bing','facebook'].includes(String(attribution.utm_source||'').toLowerCase()))params.campaign_source=String(attribution.utm_source).toLowerCase();
      if(['organic','cpc','paid_social','social','email','referral'].includes(attribution.utm_medium))params.campaign_medium=attribution.utm_medium;
      tag('event',event,params);return true;
    }catch{return false}
  }
  window.HALA_GA4={track,setConsent,needsDecision:()=>eligible&&read('halaAnalyticsConsent')==='yes'&&read(consentKey)===null,status:()=>({eligible,consented:granted,configured})};
})();
