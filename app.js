const N=window.NOORTOONA;
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const stages=['المناسبة','التفاصيل','القالب','التصميم','الضيوف','المعاينة','تأكيد الحجز'];
const H=window.HALA_BOOKING;
const track=(name,metadata={})=>H?.track(name,metadata);
const defaults={step:1,occasionKey:'wedding',activityKey:'padel',customOccasion:'',customActivity:'',template:'ليلة كحلية',name1:'',name2:'',hostName:'',date:'',time:'20:00',duration:'3',country:'السعودية',city:'الرياض',location:'',mapsUrl:'',description:'',videoUrl:'',pdfUrl:'',message:'يسعدنا حضوركم ومشاركتنا هذه المناسبة',package:'هلا بلس',capacity:'20',shareAmount:'35',shareLabel:'قيمة القطّة',requireShareConsent:true,allowNamedCompanions:true,waitlistEnabled:true,entryEntrances:1,entryHours:'',entryStart:'',entryNotes:'',requestSupervisor:false,supervisorPreference:'',guestText:'',guestCount:100,contactName:'',contactPhone:'',contactEmail:'',marketingConsent:false,referralCode:'',activityPicking:false,design:{font:'ruqaa',layout:'classic',accent:'#e3bd64',headline:'يسعدنا حضوركم',image:'',audio:'',showCountdown:true,showMap:true,showQr:true,showMaybe:true,showDecline:true,allowChildren:true,allowNotes:true,photographyPermission:false}};
let restored={};try{restored=JSON.parse(localStorage.getItem('noortoonaDraftV55')||'{}')||{}}catch{}
const state={...defaults,...restored,design:{...defaults.design,...(restored.design||{})}};
// Re-select a current package when opening an older locally saved draft.
if(!['هلا الأساسية','هلا بلس','هلا بريميوم'].includes(state.package))state.package='هلا بلس';
const hasSavedDraft=()=>Boolean(localStorage.getItem('noortoonaDraftV55'));
const modal=$('#builderModal'),body=$('#builderBody'),nextBtn=$('#nextBtn'),prevBtn=$('#prevBtn');
const saveDraft=()=>{try{localStorage.setItem('noortoonaDraftV55',JSON.stringify({...state,design:{...state.design,image:'',audio:''}}))}catch{}};
const occasion=()=>N.occasions.find(x=>x.key===state.occasionKey)||N.occasions[0];
const activity=()=>N.activities.find(x=>x.key===state.activityKey)||N.activities[0];
const groupKey=()=>state.occasionKey==='activity'?state.activityKey:state.occasionKey;
let checkoutQuote=null,quoteRevision=0,submittingBooking=false;
let catalogPackages=[],hiddenTemplateKeys=[],catalogServices=null,activeCatalog=null,pricingGuests=100;
const english=()=>window.HALA_I18N?.getLocale()==='en';
const copy=(ar,en)=>english()?en:ar;
const tierPrice=(p,count)=>p.priceTiers?.[Number(count)]??(p.guestLimit===Number(count)?p.amount:null);
const packageFeatures=p=>{if(p.includedFeatures)return p.includedFeatures;const i=['hala_basic','hala_plus','hala_premium'].indexOf(p.code);return catalogPackages.filter(x=>['hala_basic','hala_plus','hala_premium'].indexOf(x.code)<=i).flatMap(x=>x.features||[])};
const entryDetails=()=>({entrances:Number(state.entryEntrances||1),durationHours:Number(state.entryHours||0)||null,startTime:state.entryStart||state.time,city:state.city,notes:state.entryNotes||''});
const templates=()=>N.templateChoices(groupKey(),hiddenTemplateKeys);
const eventLabel=()=>state.customOccasion||(state.occasionKey==='activity'?'تجمع ونشاط':occasion().label);
const activityLabel=()=>state.occasionKey==='activity'?(state.activityKey==='activityCustom'&&state.customActivity.trim()?state.customActivity.trim():activity().label):'';
const schemaKeys=()=>new Set((window.HALA_V6_SCHEMA?.schemaFor(state.occasionKey)?.fields||[]).map(f=>f.key));
const experience=()=>window.HALA_V6_SCHEMA?.experienceFor(state.occasionKey)||{};
function applyTypeExperience(){
  const x=experience();
  state.design.headline=x.headline||state.design.headline;
  state.message=x.message||state.message;
  state.design.showMaybe=x.showMaybe!==false;
  state.design.allowChildren=x.allowChildren!==false;
  state.design.allowCompanions=x.allowCompanions!==false;
  state.design.showQr=x.showQr!==false;
  state.design.showCountdown=x.showCountdown!==false;
  state.design.showRsvp=x.showRsvp!==false;
  if(state.occasionKey==='activity'){
    state.waitlistEnabled=true;
    state.allowNamedCompanions=true;
    state.requireShareConsent=Number(state.shareAmount||0)>0;
  }
}
function cleanTypeFields(){
  const keys=schemaKeys();
  if(!keys.has('name2'))state.name2='';
  if(!keys.has('hostName'))state.hostName='';
  if(state.occasionKey!=='activity'){
    state.requireShareConsent=false;state.allowNamedCompanions=false;state.waitlistEnabled=false;
  }
}
function eventTitle(){
  const base=eventLabel();
  if(state.occasionKey==='activity')return state.name1||activityLabel()||base;
  if(['wedding','milkah','engagement'].includes(state.occasionKey))return `${base} ${state.name1}${state.name2?' و '+state.name2:''}`.trim();
  return `${base} ${state.name1||''}`.trim();
}
const progress=()=>`<div class="journey-progress" role="list" aria-label="مراحل إنشاء الدعوة">${stages.map((label,i)=>`<div class="journey-step ${i+1===state.step?'active':''} ${i+1<state.step?'done':''}" role="listitem"><span>${i+1<state.step?'✓':i+1}</span><small>${label}</small></div>`).join('')}</div>`;
const heading=(title,sub)=>`<div class="builder-heading"><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>`;
const field=(id,label,value,type='text',attrs='')=>`<label class="journey-field"><span>${label}</span><input id="${id}" type="${type}" value="${N.esc(value)}" ${attrs}></label>`;
const setTemplate=(name)=>{if(state.package==='هلا الأساسية'&&N.catalog[groupKey()]?.findIndex(t=>t.name===name)>=2){state.package='هلا بلس';toast(copy('هذا القالب ضمن بلس وبريميوم.','This template is included in Plus and Premium.'))}track('template_selected',{template:name});state.template=name;state.design.accent=N.templateByName(name,groupKey()).accent;saveDraft();render()};

function openBuilder(key='wedding',resume=false){
  nextBtn.style.display='';prevBtn.style.display='';
  track('booking_started',{occasion:key});
  if(!resume){state.occasionKey=key;state.step=1;state.activityPicking=false;cleanTypeFields();applyTypeExperience()}
  else{state.step=Math.min(7,Math.max(1,Number(state.step)||1));state.activityPicking=false}
  if(!templates().some(t=>t.name===state.template))state.template=templates()[0].name;
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('journey-open');render();
}
function closeBuilder(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('journey-open')}
function renderOccasions(){return `<div class="occasion-choice-grid">${N.occasions.map(o=>`<button type="button" class="occasion-choice ${state.occasionKey===o.key&&!state.activityPicking?'selected':''}" data-occasion="${o.key}"><span>${o.icon}</span><b>${o.label}</b></button>`).join('')}</div>${state.occasionKey==='custom'?`<label class="journey-field custom-occasion"><span>اسم المناسبة</span><input id="customOccasion" maxlength="60" value="${N.esc(state.customOccasion)}" placeholder="اكتب اسم مناسبتك"></label>`:''}`}
function renderActivities(){return `${heading('اختر النشاط','اختر النشاط المناسب لدعوتك')}<div class="activity-choice-grid">${N.activities.map(a=>`<button type="button" class="activity-choice ${state.activityKey===a.key?'selected':''}" data-activity="${a.key}"><span>${a.icon}</span><b>${a.label}</b><small>${a.key==='padel'?'Padel':a.key==='football'?'Football':''}</small></button>`).join('')}</div>${state.activityKey==='activityCustom'?`<label class="journey-field custom-occasion"><span>اسم النشاط</span><input id="customActivity" maxlength="60" value="${N.esc(state.customActivity)}" placeholder="اكتب اسم النشاط"></label>`:''}`}
function renderDetails(){
  const schema=window.HALA_V6_SCHEMA?.schemaFor(state.occasionKey);
  if(!schema)return '';
  const controls=schema.fields.map(f=>{
    if(f.type==='textarea')return `<label class="journey-field wide"><span>${f.label}</span><textarea id="${f.key}" rows="3">${N.esc(state[f.key]||'')}</textarea></label>`;
    if(f.type==='checkbox')return `<label class="journey-field wide journey-check"><input id="${f.key}" type="checkbox" ${state[f.key]?'checked':''}><span>${f.label}</span></label>`;
    const attrs=[f.required?'required':'',f.min!=null?`min="${f.min}"`:'',f.max!=null?`max="${f.max}"`:'',f.step!=null?`step="${f.step}"`:''].filter(Boolean).join(' ');
    return field(f.key,f.label,state[f.key]??'',f.type||'text',attrs);
  }).join('');
  return `${heading(state.occasionKey==='activity'?`${schema.title} — ${activityLabel()}`:schema.title,'هذه الحقول مخصصة لهذا النوع من الدعوات ولن نطلب معلومات لا تخصها')}<div class="journey-form">${controls}</div>`;
}
function thumb(t){return `<span class="template-art" style="${N.styleFor(t)}"><i></i><span><small>${N.esc(state.occasionKey==='activity'?activityLabel():occasion().label)}</small><b>${N.esc(t.name)}</b></span></span>`}
function renderTemplates(){return `${heading(`اختر قالب ${state.occasionKey==='activity'?activityLabel():occasion().label}`,'اخترنا لك الأنسب أولًا، ويمكنك مقارنة أربعة تصاميم واضحة')}<div class="visual-template-grid">${templates().map((t,i)=>`<button type="button" class="visual-template-card ${state.template===t.name?'selected':''}" data-template="${N.esc(t.name)}">${thumb(t)}${i===0?'<em class="recommended-tag">اختيار هلا</em>':''}<span class="template-caption"><b>${N.esc(t.name)}${N.catalog[groupKey()]?.findIndex(x=>x.name===t.name)>=2?' · Plus':''}</b>${state.template===t.name?'<i>✓</i>':''}</span></button>`).join('')}</div>`}
function invitePreview(){return `<div class="host-phone"><div class="host-phone-notch"></div>${N.canvas({...state,occasion:eventLabel()})}</div>`}
function renderDesign(){const x=experience();return `${heading('صمّم دعوتك','التخصيص بسيط؛ القالب هو الهوية واللون مجرد لمسة')}<div class="type-behavior-note"><b>${x.showRsvp===false?'دعوة معلوماتية بدون تأكيد حضور':x.rsvpPrompt||'تأكيد حضور مخصص'}</b><span>${x.allowCompanions===false?'بدون طلب مرافقين':'يمكن إدارة المرافقين حسب هذا النوع'}${x.showQr===false?' • بدون QR افتراضيًا':' • QR متاح'}</span></div><div class="design-workspace"><div class="host-preview-wrap">${invitePreview()}<button type="button" class="guest-preview-link" data-full-preview>معاينة كضيف بالحجم الكامل</button></div><div class="design-controls"><label><span>النص الرئيسي</span><input id="headline" maxlength="70" value="${N.esc(state.design.headline)}"></label><label><span>الخط</span><select id="font"><option value="ruqaa">رقعة أنيق</option><option value="tajawal">تجوال</option><option value="serif">كلاسيكي</option></select></label><label><span>اللون الرئيسي</span><input id="accent" type="color" value="${state.design.accent}"></label><div class="mini-template-switch"><span>تغيير القالب</span>${templates().map(t=>`<button type="button" class="mini-template ${state.template===t.name?'selected':''}" data-template="${N.esc(t.name)}">${thumb(t)}</button>`).join('')}</div><label class="image-upload"><span>استخدام صورتك كخلفية</span><input id="designImage" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="image-upload"><span>موسيقى الدعوة (اختياري، حتى 600 كيلوبايت)</span><input id="designAudio" type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac"></label>${N.safeAudioUrl(state.design.audio)?`<audio controls preload="none" src="${N.esc(state.design.audio)}" aria-label="معاينة موسيقى الدعوة"></audio><button type="button" id="removeAudio" class="outline-btn dark-outline">إزالة الموسيقى</button>`:""}<small>تعمل الموسيقى باختيار الضيف. أعد اختيار الملفات عند استعادة المسودة.</small></div></div>`}
function parseGuests(){return state.guestText.split(/\r?\n/).map(line=>{const [name,...rest]=line.split(/[,،]/);return{name:name?.trim(),phone:rest.join(',').trim()}}).filter(x=>x.name)}
function renderGuests(){const count=parseGuests().length;return `${heading('عدد المدعوين وقائمتهم','حدّد العدد المطلوب للتسعير؛ يمكنك إضافة أسماء الضيوف لاحقًا')}${field('guestCount','عدد المدعوين المطلوب',state.guestCount,'number','min="1" max="5000" step="1" required')}<div class="guest-entry"><textarea id="guestText" rows="10" placeholder="محمد العتيبي، 0500000000\nخالد الحربي، 0500000001">${N.esc(state.guestText)}</textarea><div class="guest-entry-note"><span>${count} ضيف</span><small>يمكنك أيضًا الإضافة والاستيراد من لوحة المضيف بعد الإنشاء.</small></div></div>`}
function renderReview(){const count=Number(state.guestCount);return `${heading('راجع دعوتك','هذه المعاينة تستخدم نفس الرسم الذي سيصل للضيف')}<div class="review-grid"><div>${invitePreview()}<button type="button" class="guest-preview-link" data-full-preview>معاينة كضيف</button></div><div class="review-summary"><h3>${N.esc(state.name1)}${state.name2?' و '+N.esc(state.name2):''}</h3>${state.hostName?`<p>${N.esc(state.hostName)}</p>`:''}<dl><div><dt>النوع</dt><dd>${N.esc(state.occasionKey==='activity'?activityLabel():occasion().label)}</dd></div><div><dt>التاريخ</dt><dd>${N.esc(state.date)}</dd></div><div><dt>الموقع</dt><dd>${N.esc(state.location)}</dd></div><div><dt>القالب</dt><dd>${N.esc(state.template)}</dd></div><div><dt>الضيوف</dt><dd>${count}</dd></div>${state.occasionKey==='activity'?`<div><dt>القطّة</dt><dd>${Number(state.shareAmount||0).toLocaleString('ar-SA')} ر.س للفرد</dd></div>`:''}</dl></div></div>`}
function supervisorChoice(){
  return `<fieldset class="supervisor-gender-choice"><legend>${copy('من ترغب أن يستقبل ضيوفك؟','Who would you like to welcome your guests?')}</legend>${[['male','مشرف','Male organizer'],['female','مشرفة','Female organizer'],['both','مشرف ومشرفة للمدخلين المنفصلين','Male and female organizers for separate entrances']].map(([v,ar,en])=>`<label><input type="radio" name="supervisorPreference" value="${v}" ${state.supervisorPreference===v?'checked':''}> ${copy(ar,en)}</label>`).join('')}</fieldset><div class="journey-form">${field('entryEntrances',copy('عدد مداخل الاستقبال','Reception entrances'),state.entryEntrances,'number','min="1" max="20" step="1"')}${field('entryHours',copy('مدة الخدمة المطلوبة بالساعات','Requested service hours'),state.entryHours,'number','min="0.5" max="24" step="0.5" required')}${field('entryStart',copy('وقت بدء الاستقبال','Reception start time'),state.entryStart||state.time,'time','required')}${field('entryNotes',copy('ملاحظات تنظيم الدخول','Entry organization notes'),state.entryNotes,'text','maxlength="2000"')}</div><p class="booking-notice">${copy('السعر مبدئي؛ يُراجع عدد المداخل والمدة والموقع والطاقة التشغيلية قبل تأكيد التوفر. أكثر من منظمين أو مدخلين يتطلب عرضًا مخصصًا.','Indicative price; entrances, duration, location and operational capacity are reviewed before availability is confirmed. More than two organizers or entrances requires a custom quote.')}</p>`;
}
function renderSend(){
  const count=Number(state.guestCount),e=N.esc;
  return `${heading(copy('تأكيد طلب الحجز','Review your booking request'),copy('راجع الباقة والسعر والخدمات الاختيارية','Review your package, price and optional services'))}<div class="send-card booking-checkout"><div class="package-row">${catalogPackages.map(p=>`<button type="button" data-package="${e(p.name)}" class="${state.package===p.name?'selected':''}">${e(english()?p.nameEn:p.name)} ${p.recommended?'✦':''}<small>${tierPrice(p,count)?H.money(tierPrice(p,count)):copy('عرض مخصص','Custom quote')} • ${count} ${copy('مدعو','guests')}</small></button>`).join('')}</div><details class="package-comparison"><summary>${copy('مميزات الباقة المختارة','Selected package features')}</summary><ul>${packageFeatures(catalogPackages.find(p=>p.name===state.package)||{}).map(f=>`<li>${e(english()?f.en:f.ar)}${f.status==='external'?` <em>${copy('بانتظار التفعيل','Awaiting activation')}</em>`:f.status==='assisted'?` <small>${copy('بمساعدة فريق هلا','Assisted by HALA')}</small>`:''}</li>`).join('')}</ul></details>${field('guestCount',copy('عدد المدعوين المطلوب','Requested guest count'),state.guestCount,'number','min="1" max="1000000" step="1" required')}<p>${copy('الأعداد المتاحة: 100، 250، 500. لعدد آخر اطلب عرض سعر مخصص.','Available counts: 100, 250 and 500. Request a custom quote for other counts.')}</p><fieldset class="entry-choice"><legend>${copy('هل ترغب بإضافة خدمة تنظيم الدخول؟','Would you like to add entry organization?')}</legend><label class="supervisor-addon"><input id="requestSupervisor" type="checkbox" ${state.requestSupervisor?'checked':''}><span><b>${copy('نعم، أريد تنظيم الدخول.','Yes, add entry organization.')}</b><small>${copy('عند عدم الاختيار: سأقوم بتنظيم الدخول بنفسي.','Unchecked: I will manage entry myself.')}</small></span><strong>${copy('يبدأ من','From')} ${H.money(activeCatalog?.entry?.unitAmount||59900)}</strong></label></fieldset>${state.requestSupervisor?supervisorChoice():''}<label class="journey-field"><span>${copy('كود الخصم أو الإحالة (اختياري)','Discount or referral code (optional)')}</span><input id="referralCode" maxlength="24" value="${e(state.referralCode||localStorage.getItem('halaReferralCode')||'')}" autocomplete="off"></label><button type="button" id="refreshBookingQuote" class="outline-btn dark-outline">${copy('تحديث السعر وتطبيق الكود','Refresh price and apply code')}</button><div id="bookingQuote" class="checkout-summary" aria-live="polite"></div><div class="journey-form contact-details">${field('contactName',copy('اسم العميل','Customer name'),state.contactName,'text','autocomplete="name" maxlength="120" required')}${field('contactPhone',copy('رقم الجوال','Mobile number'),state.contactPhone,'tel','autocomplete="tel" required')}${field('contactEmail',copy('البريد الإلكتروني (اختياري)','Email (optional)'),state.contactEmail,'email','maxlength="180"')}<label class="journey-check"><input id="marketingConsent" type="checkbox" ${state.marketingConsent?'checked':''}><span>${copy('أوافق اختياريًا على استقبال أخبار وعروض هلا.','I optionally agree to HALA news and offers.')}</span></label></div><p class="booking-notice">${copy('سيُحفظ طلب حجز مبدئي، ويتواصل الفريق لاستكمال الدفع والتأكيد النهائي. تنظيم الدخول إضافة مستقلة لجميع الباقات.','A preliminary request is saved. The team will contact you to complete payment and confirmation. Entry organization is separate for every package.')}</p><a href="#quoteRequest" id="checkoutCustomQuote">${copy('اطلب عرض سعر مخصص','Request a custom quote')}</a></div>`;
}

async function updateBookingQuote(){
  if(state.step!==7)return;
  saveInputs();const revision=++quoteRevision;checkoutQuote=null;
  const element=$('#bookingQuote',body);if(!element)return;
  element.innerHTML='<span>جاري حساب السعر من هلا…</span>';
  nextBtn.disabled=true;
  try{
    const selected=catalogPackages.find(p=>p.name===state.package);
    const data=await H.api('/api/bookings/quote',{method:'POST',body:JSON.stringify({packageCode:selected?.code,template:state.template,design:{occasionKey:state.occasionKey,activityKey:state.activityKey},guestCount:Number(state.guestCount),services:state.requestSupervisor?['supervisor']:[],supervisorPreference:state.supervisorPreference,entryDetails:entryDetails(),referralCode:state.referralCode||''})});
    if(revision!==quoteRevision||state.step!==7)return;
    checkoutQuote=data.quote;
    element.innerHTML=`<span>الباقة ${H.money(data.quote.baseAmount)}</span><span>الخدمات ${H.money(data.quote.addonAmount)}</span><span>الخصم ${H.money(data.quote.discountAmount)}</span><span>${copy('الضريبة','Tax')}: ${data.quote.taxStatus==='unconfigured'?copy('بانتظار إعداد المنشأة — السعر مبدئي','Awaiting business configuration — indicative price'):data.quote.taxStatus==='not_registered'?copy('غير مسجلة وفق الإعداد','Not registered per settings'):H.money(data.quote.taxAmount)}</span><strong>${copy('الإجمالي','Total')} ${H.money(data.quote.total)}</strong>${data.quote.entry?`<small>${data.quote.entry.organizers} ${copy('منظم — التوفر قيد المراجعة','organizer(s) — availability pending review')}</small>`:''}<small>لا يتم الدفع الآن — تأكيد نهائي بعد التواصل</small>`;
    track('price_viewed',{package:selected?.code});
  }catch(error){if(revision===quoteRevision&&state.step===7)element.innerHTML=`<span role="alert">${N.esc(error.message)}</span>`;}
  finally{if(revision===quoteRevision)nextBtn.disabled=submittingBooking||!checkoutQuote;}
}
function render(){
  $('.builder-progress').style.display='none';let content='';
  if(state.step===1)content=state.activityPicking?renderActivities():`${heading('اختر نوع المناسبة','كل لحظة تستحق دعوة أجمل')}${renderOccasions()}`;
  if(state.step===2)content=renderDetails();if(state.step===3)content=renderTemplates();if(state.step===4)content=renderDesign();if(state.step===5)content=renderGuests();if(state.step===6)content=renderReview();if(state.step===7)content=renderSend();
  body.innerHTML=`${progress()}<div class="journey-save-state"><span>✓ محفوظ تلقائيًا</span><b>الخطوة ${state.step} من ${stages.length}</b></div><div class="journey-content">${content}</div>`;body.scrollTop=0;prevBtn.style.visibility=state.step===1&&!state.activityPicking?'hidden':'visible';nextBtn.textContent=state.step===7?'تأكيد طلب الحجز':'التالي ←';nextBtn.disabled=submittingBooking;bind();if(state.step===7)updateBookingQuote();requestAnimationFrame(()=>$('.journey-step.active',body)?.scrollIntoView({block:'nearest',inline:'center'}));
}
function bind(){
  $$('[data-occasion]',body).forEach(b=>b.onclick=()=>{state.occasionKey=b.dataset.occasion;track('occasion_selected',{occasion:state.occasionKey});state.customOccasion='';cleanTypeFields();applyTypeExperience();if(state.occasionKey==='activity')state.activityPicking=true;else{state.activityPicking=false;state.template=templates()[0].name}saveDraft();render()});
  $$('[data-activity]',body).forEach(b=>b.onclick=()=>{state.activityKey=b.dataset.activity;state.template=templates()[0].name;saveDraft();render()});
  $$('[data-template]',body).forEach(b=>b.onclick=()=>setTemplate(b.dataset.template));$$('[data-package]',body).forEach(b=>b.onclick=()=>{saveInputs();state.package=b.dataset.package;saveDraft();track('package_viewed',{package:state.package});render()});$$('[data-full-preview]',body).forEach(b=>b.onclick=openFullPreview);const supervisorToggle=$('#requestSupervisor',body);if(supervisorToggle)supervisorToggle.onchange=e=>{saveInputs();state.requestSupervisor=e.target.checked;saveDraft();render()};
  $$('input[name="supervisorPreference"]',body).forEach(radio=>radio.onchange=e=>{saveInputs();state.supervisorPreference=e.target.value;saveDraft();render()});
  $('#checkoutCustomQuote',body)?.addEventListener('click',()=>{saveInputs();closeBuilder()});
  $('#refreshBookingQuote',body)?.addEventListener('click',updateBookingQuote);
  ['guestCount','referralCode','entryEntrances','entryHours','entryStart','entryNotes'].forEach(id=>$('#'+id,body)?.addEventListener('input',()=>{checkoutQuote=null;nextBtn.disabled=true;clearTimeout(window.__quoteTimer);window.__quoteTimer=setTimeout(updateBookingQuote,300)}));
  let contactTracked=false;['contactName','contactPhone','contactEmail'].forEach(id=>$('#'+id,body)?.addEventListener('input',()=>{if(!contactTracked){track('contact_started');contactTracked=true}}));
  const font=$('#font',body);if(font){font.value=state.design.font;font.onchange=e=>{state.design.font=e.target.value;render()}}const headline=$('#headline',body);if(headline)headline.oninput=e=>{state.design.headline=e.target.value;$('.invite-headline',body).textContent=e.target.value;saveDraft()};const accent=$('#accent',body);if(accent)accent.oninput=e=>{state.design.accent=e.target.value;$('.invite-canvas',body).style.setProperty('--invite-accent',e.target.value);saveDraft()};const upload=$('#designImage',body);if(upload)upload.onchange=handleImage;const audio=$('#designAudio',body);if(audio)audio.onchange=handleAudio;const removeAudio=$('#removeAudio',body);if(removeAudio)removeAudio.onclick=()=>{state.design.audio='';saveDraft();render()};
  $$('input:not([type=file]),textarea,select',body).forEach(el=>el.addEventListener('input',()=>{clearTimeout(window.__draftSave);window.__draftSave=setTimeout(saveInputs,250)}));
}
function saveInputs(){['entryEntrances','entryHours','entryStart','entryNotes','customOccasion','customActivity','name1','name2','hostName','date','time','location','city','mapsUrl','message','capacity','shareAmount','guestText','guestCount','contactName','contactPhone','contactEmail','referralCode'].forEach(k=>{const el=$('#'+k,body);if(el)state[k]=el.value});['requireShareConsent','allowNamedCompanions','waitlistEnabled','requestSupervisor','marketingConsent'].forEach(k=>{const el=$('#'+k,body);if(el)state[k]=el.checked});saveDraft()}
function validUrl(v){if(!v)return true;try{return['https:','http:'].includes(new URL(v).protocol)}catch{return false}}
function validate(){if(state.step===7&&state.requestSupervisor&&!['male','female','both'].includes(state.supervisorPreference))return'اختر مشرفًا أو مشرفة قبل المتابعة';if(state.step===1&&state.occasionKey==='custom'&&!state.customOccasion.trim())return'اكتب اسم المناسبة';if(state.step===1&&state.activityPicking&&state.activityKey==='activityCustom'&&!state.customActivity.trim())return'اكتب اسم النشاط';if(state.step===2){const schema=window.HALA_V6_SCHEMA?.schemaFor(state.occasionKey);for(const f of (schema?.fields||[])){if(f.required&&!String(state[f.key]||'').trim())return 'أكمل حقل: '+f.label}if(!validUrl(state.mapsUrl))return'رابط الموقع غير صالح';if(state.occasionKey==='activity'&&Number(state.capacity)<1)return'أدخل سعة صحيحة'}return''}
function handleImage(e){const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>10*1024*1024)return toast('اختر صورة صالحة أقل من 10MB');const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const image=canvas.toDataURL('image/jpeg',.78);if(image.length>600000)return toast('الصورة كبيرة؛ اختر صورة أصغر');state.design.image=image;saveDraft();render()};img.onerror=()=>toast('تعذر قراءة الصورة');img.src=reader.result};reader.readAsDataURL(file)}
function handleAudio(e){const file=e.target.files?.[0];if(!file)return;if(!['audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/aac'].includes(file.type)||file.size>600*1024)return toast('اختر ملف صوت أقل من 600 كيلوبايت');const reader=new FileReader();reader.onload=()=>{const audio=N.safeAudioUrl(reader.result);if(!audio)return toast('صيغة الملف غير مدعومة');state.design.audio=audio;saveDraft();render()};reader.onerror=()=>toast('تعذر قراءة الصوت');reader.readAsDataURL(file)}
function openFullPreview(){let overlay=$('#journeyFullPreview');if(!overlay){overlay=document.createElement('div');overlay.id='journeyFullPreview';overlay.className='journey-full-preview';document.body.appendChild(overlay)}overlay.innerHTML=`<button type="button" aria-label="إغلاق">×</button><div class="full-preview-phone">${N.canvas({...state,occasion:eventLabel()},{guestName:'ضيف هلا'})}</div>`;overlay.classList.add('open');$('button',overlay).onclick=()=>overlay.classList.remove('open')}
async function createEvent(){
  if(submittingBooking)return;
  if(!checkoutQuote)return toast('راجع السعر النهائي قبل تأكيد الحجز');
  saveInputs();cleanTypeFields();
  if(!state.contactName.trim()||!state.contactPhone.trim())return toast('أدخل اسم العميل ورقم جواله');
  if(!state.date||!state.location.trim())return toast('حدّد تاريخ المناسبة وموقعها قبل الحجز');
  submittingBooking=true;nextBtn.disabled=true;nextBtn.textContent='جاري حفظ طلب الحجز…';
  try{
    const session=H.session();
    if(session?.user&&session.user.role!=='customer')throw new Error('أنشئ الحجز من حساب عميل أو سجّل الخروج أولًا');
    const selected=catalogPackages.find(p=>p.name===state.package);
    const eventPayload={...state,requestSupervisor:false,referralCode:'',package:selected?.code,occasion:eventLabel(),activityType:activityLabel(),title:eventTitle(),design:{...state.design,hostName:state.hostName||'',occasionKey:state.occasionKey,activityKey:state.activityKey,supervisorPreference:state.requestSupervisor?state.supervisorPreference:''}};
    delete eventPayload.createdEvent;delete eventPayload.bookingAccessToken;delete eventPayload.bookingIdempotencyKey;
    delete eventPayload.contactName;delete eventPayload.contactPhone;delete eventPayload.contactEmail;delete eventPayload.marketingConsent;
    if(!state.bookingIdempotencyKey)state.bookingIdempotencyKey=crypto.randomUUID();
    if(!state.bookingAccessToken)state.bookingAccessToken=H.secret();
    saveDraft();
    if(!state.createdEvent){
      const data=await H.api('/api/events',{method:'POST',body:JSON.stringify(eventPayload)});
      state.createdEvent={id:data.event.id,ownerToken:data.ownerToken};saveDraft();
      localStorage.setItem('noortoonaOwner',JSON.stringify({eventId:data.event.id,ownerToken:data.ownerToken}));
    }
    const result=await H.api('/api/bookings',{method:'POST',body:JSON.stringify({eventId:state.createdEvent.id,ownerToken:state.createdEvent.ownerToken,idempotencyKey:state.bookingIdempotencyKey,accessToken:state.bookingAccessToken,contact:{name:state.contactName.trim(),phone:state.contactPhone.trim(),email:state.contactEmail.trim()},packageCode:selected?.code,template:state.template,design:{occasionKey:state.occasionKey,activityKey:state.activityKey},guestCount:Number(state.guestCount),services:state.requestSupervisor?['supervisor']:[],supervisorPreference:state.supervisorPreference,entryDetails:entryDetails(),referralCode:state.referralCode||'',...H.context(),marketingConsent:state.marketingConsent,expectedTotal:checkoutQuote?.total})});
    H.remember(result.booking,result.accessToken||state.bookingAccessToken);
    localStorage.removeItem('noortoonaDraftV55');
    const booking=result.booking;
    body.innerHTML=`<section class="booking-success" role="status"><img class="auth-logo" src="/assets/brand/hala-logo-dark.svg?v=20261102" alt="هلا HALA"><h2>تم تسجيل طلب حجزك بنجاح! ✨</h2><p>شكرًا لاختيارك هلا.</p><p>تم استلام تفاصيل مناسبتك وحفظ طلبك برقم:</p><strong class="booking-number">${N.esc(booking.booking_number)}</strong><p>سيتواصل معك فريق هلا قريبًا لاستكمال إجراءات الدفع والتأكيد النهائي.</p><p>يمكنك متابعة تفاصيل طلبك من حسابك في هلا.</p><p class="booking-notice">تسجيل الطلب لا يعني إتمام الدفع أو اعتماد الحجز النهائي.</p><div class="event-actions"><a class="gold-btn" href="/booking.html?id=${encodeURIComponent(booking.id)}">عرض حجزي</a><a class="outline-btn dark-outline" href="${H.whatsapp(booking.booking_number)}" target="_blank" rel="noopener noreferrer">التواصل مع خدمة العملاء</a></div><p>لحظتك .. تبدأ بهلا 🤍</p></section>`;
    body.scrollTop=0;nextBtn.style.display='none';prevBtn.style.display='none';
    // Guest list import is a separate optional operation; booking remains saved if it fails.
    const guests=parseGuests();
    if(guests.length){try{await H.api('/api/guests',{method:'POST',headers:{'x-noortoona-owner-token':state.createdEvent.ownerToken},body:JSON.stringify({eventId:state.createdEvent.id,guests})});}catch{toast('حُفظ الحجز. يمكنك إكمال إضافة المدعوين من لوحة المناسبة لاحقًا.');}}
  }catch(error){toast(error.message);nextBtn.disabled=false;nextBtn.textContent='تأكيد طلب الحجز';}
  finally{submittingBooking=false;}
}
nextBtn.onclick=async()=>{saveInputs();const error=validate();if(error)return toast(error);if(state.step===1&&state.activityPicking){state.activityPicking=false;state.step=2;saveDraft();render();return}if(state.step<7){state.step++;saveDraft();render();return}await createEvent()};prevBtn.onclick=()=>{saveInputs();if(state.step===1&&state.activityPicking){state.activityPicking=false;saveDraft();render();return}if(state.step>1){state.step--;saveDraft();render()}};
$$('[data-start]').forEach(b=>b.onclick=()=>openBuilder(state.occasionKey));$$('[data-close]').forEach(b=>b.onclick=closeBuilder);document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeBuilder();$('#journeyFullPreview')?.classList.remove('open')}});
function renderLanding(){
  const grid=$('#occasionGrid');
  if(grid)grid.innerHTML=N.occasions.map(o=>`<button class="occasion-card" data-land-occasion="${o.key}"><span class="occasion-icon">${o.icon}</span><strong>${o.label}</strong><small>ابدأ الآن</small></button>`).join('');
  $$('[data-land-occasion]').forEach(b=>b.onclick=()=>openBuilder(b.dataset.landOccasion));
  const tg=$('#templateGrid');
  if(tg)tg.innerHTML=N.templateChoices('wedding',hiddenTemplateKeys).map(t=>`<button class="template-card" data-land-template="${N.esc(t.name)}">${thumb(t)}<span class="template-name">${N.esc(t.name)}</span></button>`).join('');
  $$('[data-land-template]').forEach(b=>b.onclick=()=>{state.occasionKey='wedding';cleanTypeFields();applyTypeExperience();state.template=b.dataset.landTemplate;state.step=3;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('journey-open');render()});
  const pg=$('#priceGrid');
  if(pg)pg.innerHTML=catalogPackages.length?catalogPackages.map(p=>`<article class="price-card ${p.recommended?'featured':''}">${p.recommended?`<span class="price-tag">${copy('موصى بها','Recommended')}</span>`:''}<h3>${N.esc(english()?p.nameEn:p.name)}</h3><p>${N.esc(english()?p.taglineEn:p.tagline)}</p><div class="price-number">${H.money(tierPrice(p,pricingGuests))}</div><p>${pricingGuests} ${copy('مدعو','guests')}</p><details><summary>${copy('مقارنة المميزات','Compare features')}</summary><ul>${packageFeatures(p).map(f=>`<li>${N.esc(english()?f.en:f.ar)}${f.status==='external'?` <em class="feature-pending">${copy('بانتظار التفعيل','Awaiting activation')}</em>`:''}${f.status==='assisted'?` <small>${copy('بمساعدة الفريق','Assisted service')}</small>`:''}</li>`).join('')}</ul></details><p class="package-extra">${copy('تنظيم الدخول إضافة مستقلة','Entry organization is a separate add-on')}</p><button type="button" class="gold-btn" data-land-package="${N.esc(p.name)}">${copy('اختر الباقة','Select package')}</button></article>`).join(''):`<p>${copy('جاري تحميل الباقات…','Loading packages…')}</p>`;
  $$('[data-land-package]').forEach(b=>b.onclick=()=>{state.package=b.dataset.landPackage;state.guestCount=pricingGuests;track('package_viewed',{package:state.package});openBuilder(state.occasionKey)});
  const business=$('#businessPriceGrid');if(business&&activeCatalog?.business)business.innerHTML=activeCatalog.business.map(p=>`<article class="business-price-card"><h4>${N.esc(english()?p.nameEn:p.name)}</h4><strong>${copy('يبدأ من','From')} ${H.money(p.startingAmount)}</strong><p>${copy('سعر ابتدائي للخدمة أو الفعالية وفق نطاق العمل','Starting price per service or event, subject to scope')}</p><ul>${(english()?p.featuresEn:p.features).map(f=>`<li>${N.esc(f)}</li>`).join('')}</ul><a class="gold-btn" href="#quoteRequest" data-business-type="${p.code}">${copy('اطلب عرض سعر','Request a quote')}</a></article>`).join('');
  const entryHeading=$('#entryPriceHeading');if(entryHeading&&activeCatalog)entryHeading.textContent=copy('تنظيم الدخول — يبدأ من ','Entry organization — from ')+H.money(activeCatalog.entry.unitAmount);
  const entryText=$('#entryPriceDetails');if(entryText&&activeCatalog){const unit=activeCatalog.entry.unitAmount;entryText.textContent=copy('حتى 250 مدعوًا: منظم واحد بسعر مبدئي '+H.money(unit)+'. 500 مدعو: منظمان بسعر مبدئي '+H.money(unit*2)+'. المشرف والمشرفة معًا يحسبان شخصين.','Up to 250 guests: one organizer from '+H.money(unit)+'. 500 guests: two organizers from '+H.money(unit*2)+'. A male and a female organizer count as two people.');}
  const tax=$('#taxNotice');if(tax)tax.textContent=activeCatalog?.tax?.status==='registered'?copy(activeCatalog.tax.pricesIncludeTax?'الأسعار شاملة الضريبة وفق إعداد المنشأة.':'تضاف الضريبة وفق إعداد المنشأة في الملخص.',activeCatalog.tax.pricesIncludeTax?'Prices include tax per business settings.':'Tax is added at checkout per business settings.'):activeCatalog?.tax?.status==='not_registered'?copy('المنشأة غير مسجلة ضريبيًا وفق إعداداتها.','The business is not tax registered per its settings.'):copy('حالة التسجيل الضريبي لم تضبط بعد. الأسعار مبدئية لحين تأكيد المنشأة.','Tax registration has not been configured. Prices remain indicative until business confirmation.');
  $$('[data-business-type]').forEach(a=>a.onclick=()=>{$('#quoteRequestType').value=a.dataset.businessType;});
  const services=$('#services .service-grid');
  if(services&&catalogServices)services.innerHTML=catalogServices.map(service=>`<article><span>✦</span><h3>${N.esc(service.name)}</h3><p>${N.esc(service.description)}</p></article>`).join('')||'<p>لا توجد خدمات إضافية متاحة حاليًا.</p>';

}
function initHalaPlanner(){
  const form=$('#halaPlannerForm'),result=$('#plannerResult');if(!form||!result)return;
  const plans={
    wedding:['ثبّت القاعة والموقع أولًا','جهّز قائمة الضيوف حسب العائلات والفئات','اختر قالب الزواج وأدخل اسم العريس والعروس','اختبر الدعوة على واتساب قبل الإرسال','فعّل RSVP وQR قبل موعد المناسبة'],
    milkah:['حدّد مكان الملكة','أدخل اسم العريس واسم العروس','اختر قالب الملكة المناسب','رتّب قائمة الضيوف والتأكيدات','راجع الموقع والوقت قبل الإرسال'],
    engagement:['حدّد مكان الخطوبة','أدخل اسم الخطيب واسم الخطيبة','اختر هوية الخطوبة','رتّب قائمة الضيوف والتأكيدات','راجع الموقع والوقت قبل الإرسال'],
    graduation:['أدخل اسم الخريج أو الخريجة فقط','حدّد مكان الحفل والوقت','اختر قالب تخرج واضح','أضف المدعوين وأرسل تجربة','فعّل متابعة الحضور'],
    birthday:['أدخل اسم صاحب عيد الميلاد فقط','حدّد المكان والوقت','اختر طابع المناسبة','أضف الضيوف','تابع التأكيدات قبل الموعد'],
    activity:['سمّ النشاط أو التجمع — بدون اسم شخص ثانٍ','حدّد العدد الأقصى والموقع','فعّل القطّة والمرافقين إذا احتجتها','استخدم قائمة الانتظار عند اكتمال العدد','شارك الرابط وتابع المشاركين'],
    meeting:['اكتب عنوان الاجتماع والجهة أو صاحب الدعوة','حدّد الموقع والموعد','أضف المدعوين للاجتماع','أرسل الدعوة الرسمية','تابع تأكيد الحضور'],
    conference:['اكتب اسم المؤتمر والجهة المنظمة','حدّد الموقع والموعد','قسّم المدعوين حسب الفئة','أرسل الدعوات الرسمية','استخدم QR لتسجيل الدخول']
  };
  form.onsubmit=e=>{e.preventDefault();const type=$('#plannerType').value,city=$('#plannerCity').value.trim()||'مدينتك',guests=Math.max(1,Number($('#plannerGuests').value)||1),budget=Math.max(0,Number($('#plannerBudget').value)||0),steps=plans[type]||plans.wedding;result.innerHTML=`<span class="planner-star">✦</span><h3>خطة مبدئية من هلا</h3><p><strong>${guests.toLocaleString('ar-SA')}</strong> ضيف في <strong>${N.esc(city)}</strong>${budget?` بميزانية ${budget.toLocaleString('ar-SA')} ر.س`:''}.</p><ul>${steps.map(s=>`<li>${s}</li>`).join('')}</ul>`;};
}
renderLanding();initHalaPlanner();const resumeDraft=$('#resumeDraft');if(resumeDraft&&hasSavedDraft()){resumeDraft.classList.remove('hidden');resumeDraft.onclick=()=>openBuilder(state.occasionKey,true)}const dashboardDemo=$('#dashboardDemoBtn');if(dashboardDemo)dashboardDemo.onclick=()=>{const o=JSON.parse(localStorage.getItem('noortoonaOwner')||'null');o?location.href=`/dashboard?event=${encodeURIComponent(o.eventId)}`:toast('أنشئ مناسبة أولًا لفتح لوحة المضيف')};const mobileBtn=$('#mobileMenuBtn'),mobile=$('#mobileMenu');if(mobileBtn&&mobile)mobileBtn.onclick=()=>{const open=mobile.classList.toggle('open');mobileBtn.setAttribute('aria-expanded',String(open));mobile.setAttribute('aria-hidden',String(!open))};function toast(message){const t=$('#toast');if(!t)return;t.textContent=message;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3200)}

// Read the same catalog used by server checkout; keep approved defaults when offline.
fetch('/api/catalog',{headers:{accept:'application/json'}}).then(async response=>{if(!response.ok)throw Error('catalog unavailable');return response.json()}).then(value=>{
  const catalog=N.catalogData(value);if(!catalog)return;
  activeCatalog=catalog;catalogPackages=catalog.packages;hiddenTemplateKeys=catalog.hiddenTemplateKeys;catalogServices=catalog.services;
  if(!catalogPackages.some(p=>p.name===state.package))state.package=catalogPackages[0].name;
  if(!templates().some(t=>t.name===state.template)&&templates()[0])state.template=templates()[0].name;
  renderLanding();
  if(modal.classList.contains('open')&&[3,4,7].includes(state.step)){saveInputs();render()}
}).catch(()=>{});

document.addEventListener('hala:localechange',()=>{renderLanding();if(modal.classList.contains('open')){saveInputs();render()}});
$('#pricingGuestCount')?.addEventListener('change',e=>{pricingGuests=Number(e.target.value);renderLanding()});
