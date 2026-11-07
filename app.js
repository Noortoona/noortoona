const N=window.NOORTOONA;
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const stages=['المناسبة','التفاصيل','القالب','التصميم','الضيوف','المعاينة','تأكيد الحجز'];
const H=window.HALA_BOOKING;
const track=(name,metadata={})=>H?.track(name,metadata);
const defaults={step:1,occasionKey:'wedding',activityKey:'padel',customOccasion:'',customActivity:'',template:'ليلة كحلية',name1:'',name2:'',hostName:'',date:'',time:'20:00',duration:'3',country:'السعودية',city:'الرياض',location:'',mapsUrl:'',description:'',videoUrl:'',pdfUrl:'',message:'يسعدنا حضوركم ومشاركتنا هذه المناسبة',package:'هلا بلس',capacity:'20',shareAmount:'35',shareLabel:'قيمة القطّة',requireShareConsent:true,allowNamedCompanions:true,waitlistEnabled:true,requestSupervisor:false,supervisorPreference:'',guestText:'',guestCount:100,contactName:'',contactPhone:'',contactEmail:'',marketingConsent:false,referralCode:'',activityPicking:false,design:{font:'ruqaa',layout:'classic',accent:'#e3bd64',headline:'يسعدنا حضوركم',image:'',audio:'',showCountdown:true,showMap:true,showQr:true,showMaybe:true,showDecline:true,allowChildren:true,allowNotes:true,photographyPermission:false}};
let restored={};try{restored=JSON.parse(localStorage.getItem('noortoonaDraftV55')||'{}')||{}}catch{}
const state={...defaults,...restored,design:{...defaults.design,...(restored.design||{})}};
// Re-select a current package when opening an older locally saved draft.
if(!['هلا الأساسية','هلا بلس','هلا بريميوم'].includes(state.package))state.package='هلا بلس';
const hasSavedDraft=()=>{try{return Boolean(localStorage.getItem('noortoonaDraftV55'))}catch{return false}};
const modal=$('#builderModal'),body=$('#builderBody'),nextBtn=$('#nextBtn'),prevBtn=$('#prevBtn');
let draftSaveFailed=false;
const saveDraft=()=>{try{localStorage.setItem('noortoonaDraftV55',JSON.stringify(state));draftSaveFailed=false}catch{draftSaveFailed=true}const indicator=$('.journey-save-state>span',body);if(indicator)indicator.textContent=draftSaveFailed?'تعذر حفظ المسودة على الجهاز؛ احتفظ بالصفحة مفتوحة':'✓ محفوظ تلقائيًا'};
const occasion=()=>N.occasions.find(x=>x.key===state.occasionKey)||N.occasions[0];
const activity=()=>N.activities.find(x=>x.key===state.activityKey)||N.activities[0];
const groupKey=()=>state.occasionKey==='activity'?state.activityKey:state.occasionKey;
let checkoutQuote=null,quoteRevision=0,submittingBooking=false;
let catalogPackages=[{code:'hala_basic',name:'هلا الأساسية',amount:44900,amountSar:449,guestLimit:100},{code:'hala_plus',name:'هلا بلس',amount:109900,amountSar:1099,guestLimit:250},{code:'hala_premium',name:'هلا بريميوم',amount:179900,amountSar:1799,guestLimit:500}],hiddenTemplateKeys=[],catalogServices=null;
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
let weddingFilter='all',landingWeddingFilter='all',previewOrigin=null,previewData=null,previewIsFull=false;
const selectedTemplate=()=>N.templateByName(state.template,groupKey(),state.design.templateId);
const setTemplate=(name)=>{saveInputs();const t=N.templateByName(name,groupKey());track('template_selected',{template:name});state.template=t.name;const previous=state.design;state.design=t.version===2?N.normalizeWeddingDesign(t,{...previous,templateId:t.id,accent:t.accent,font:previous.templateVersion===2?previous.font:t.font}):{...previous,templateId:'',templateVersion:1,accent:t.accent};saveDraft();render()};

function openBuilder(key='wedding',resume=false){
  nextBtn.style.display='';prevBtn.style.display='';
  track('booking_started',{occasion:key});
  if(!resume){state.occasionKey=key;state.step=1;state.activityPicking=false;cleanTypeFields();applyTypeExperience()}
  else{state.step=Math.min(7,Math.max(1,Number(state.step)||1));state.activityPicking=false}
  if(!templates().some(t=>t.name===state.template))state.template=templates()[0].name;
  state.design.templateId=N.templateByName(state.template,groupKey()).id||'';
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
function thumb(t){if(t.version===2)return `<span class="template-art wedding-thumbnail" data-composition="${t.slug}" data-tone="${t.tone}" data-image-state="loading">${N.weddingPicture(t,true)}<span class="thumbnail-status" role="status">جاري تحميل التصميم…</span><span class="thumbnail-specimen" aria-hidden="true"><small>دعوة زفاف</small>${t.ornament==='monogram'?'<em>م · ن</em>':''}<b>محمد <i>و</i> نورة</b><small>نتشرّف بحضوركم</small><span>١٢ . ١٢ . ٢٠٢٦</span></span></span>`;return `<span class="template-art" style="${N.styleFor(t)}"><i></i><span><small>${N.esc(state.occasionKey==='activity'?activityLabel():occasion().label)}</small><b>${N.esc(t.name)}</b></span></span>`}
function weddingFilterBar(value,context){return `<div class="wedding-filters" role="group" aria-label="تصفية قوالب الزواج">${N.weddingFilters.map(f=>`<button type="button" data-${context}-filter="${f.key}" aria-pressed="${value===f.key}" class="${value===f.key?'active':''}">${f.label}</button>`).join('')}</div>`}
function weddingCards(items,context){return items.map(t=>`<article class="${context==='builder'?'visual-template-card ':''}wedding-template-card ${context==='builder'&&state.template===t.name?'selected':''}" data-card-template="${N.esc(t.name)}">${thumb(t)}${t.curated?'<em class="recommended-tag">مختارات هلا</em>':''}<div class="wedding-card-copy"><h3>${N.esc(t.name)}</h3><p>${N.collectionLabel(t)}</p><div class="wedding-card-actions"><button type="button" data-template-preview="${N.esc(t.name)}" data-preview-context="${context}" aria-label="معاينة ${N.esc(t.name)}">معاينة</button><button type="button" ${context==='builder'?'data-template':'data-land-template'}="${N.esc(t.name)}" aria-label="اختيار قالب ${N.esc(t.name)}" aria-pressed="${context==='builder'&&state.template===t.name}">${context==='builder'&&state.template===t.name?'✓ تم الاختيار':'اختيار القالب'}</button></div></div></article>`).join('')}
function renderTemplates(){if(groupKey()==='wedding'){const items=N.filterTemplates(templates(),weddingFilter);return `${heading('اختر قالب زواجك','اثنا عشر تصميمًا جديدًا، وثلاثة عوالم من الأناقة. تخصيصك محفوظ عند مقارنة القوالب.')}<section class="wedding-library">${weddingFilterBar(weddingFilter,'builder')}<p class="wedding-result-count" role="status">${items.length} قالب متاح</p><div class="visual-template-grid">${weddingCards(items,'builder')||'<p>لا توجد قوالب متاحة في هذا التصنيف حاليًا.</p>'}</div></section>`}return `${heading(`اختر قالب ${state.occasionKey==='activity'?activityLabel():occasion().label}`,'اختر التصميم الأنسب لمناسبتك')}<div class="visual-template-grid">${templates().map(t=>`<button type="button" class="visual-template-card ${state.template===t.name?'selected':''}" data-template="${N.esc(t.name)}">${thumb(t)}<span class="template-caption"><b>${N.esc(t.name)}</b>${state.template===t.name?'<i>✓</i>':''}</span></button>`).join('')}</div>`}
function invitePreview(){return `<div class="host-phone"><div class="host-phone-notch"></div>${N.canvas({...state,occasion:eventLabel()})}</div>`}
function renderLegacyDesign(){const x=experience();return `${heading('صمّم دعوتك','التخصيص بسيط؛ القالب هو الهوية واللون مجرد لمسة')}<div class="type-behavior-note"><b>${x.showRsvp===false?'دعوة معلوماتية بدون تأكيد حضور':x.rsvpPrompt||'تأكيد حضور مخصص'}</b><span>${x.allowCompanions===false?'بدون طلب مرافقين':'يمكن إدارة المرافقين حسب هذا النوع'}${x.showQr===false?' • بدون QR افتراضيًا':' • QR متاح'}</span></div><div class="design-workspace"><div class="host-preview-wrap">${invitePreview()}<button type="button" class="guest-preview-link" data-full-preview>معاينة كضيف بالحجم الكامل</button></div><div class="design-controls"><label><span>النص الرئيسي</span><input id="headline" maxlength="70" value="${N.esc(state.design.headline)}"></label><label><span>الخط</span><select id="font"><option value="ruqaa">رقعة أنيق</option><option value="tajawal">تجوال</option><option value="amiri">أميري</option><option value="serif">كلاسيكي</option></select></label><label><span>اللون الرئيسي</span><input id="accent" type="color" value="${state.design.accent}"></label><div class="mini-template-switch"><span>تغيير القالب</span>${templates().map(t=>`<button type="button" class="mini-template ${state.template===t.name?'selected':''}" data-template="${N.esc(t.name)}">${thumb(t)}</button>`).join('')}</div><label class="image-upload"><span>استخدام صورتك كخلفية</span><input id="designImage" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="image-upload"><span>موسيقى الدعوة (اختياري، حتى 600 كيلوبايت)</span><input id="designAudio" type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac"></label>${N.safeAudioUrl(state.design.audio)?`<audio controls preload="none" src="${N.esc(state.design.audio)}" aria-label="معاينة موسيقى الدعوة"></audio><button type="button" id="removeAudio" class="outline-btn dark-outline">إزالة الموسيقى</button>`:""}<small>تعمل الموسيقى باختيار الضيف. تحفظ التخصيصات مع مسودة الدعوة على هذا الجهاز.</small></div></div>`}
function renderDesign(){
  const t=selectedTemplate();if(t.version!==2)return renderLegacyDesign();
  state.design=N.normalizeWeddingDesign(t,state.design);const d=state.design;
  return `${heading('صمّم دعوتك','كل تفاصيل فرحتك، بتصميم يحمل ذوقك. تتحدث المعاينة أثناء الكتابة.')}<div class="design-workspace wedding-design-workspace"><div class="host-preview-wrap">${invitePreview()}<button type="button" class="guest-preview-link" data-full-preview>معاينة الجوال والنسخة الكاملة</button></div><div class="design-controls wedding-design-controls">
    <div class="wedding-editor-heading"><b>${N.esc(t.name)}</b><small>${N.collectionLabel(t)}</small></div>
    <fieldset><legend>تفاصيل الدعوة</legend>${field('name1','اسم العريس',state.name1,'text','maxlength="180" required')}${field('name2','اسم العروس',state.name2,'text','maxlength="180" required')}${field('eventTitleInput','عنوان المناسبة',d.eventTitle||'دعوة زفاف','text','maxlength="100"')}${field('headline','العبارة الترحيبية',d.headline,'text','maxlength="140"')}<label><span>نص الدعوة</span><textarea id="message" rows="3" maxlength="3000">${N.esc(state.message)}</textarea></label><div class="wedding-editor-pair">${field('date','التاريخ',state.date,'date')}${field('time','الوقت',state.time,'time')}</div>${field('location','الموقع',state.location,'text','maxlength="220"')}<label><span>ملاحظات إضافية</span><textarea id="designNotes" rows="2" maxlength="500">${N.esc(d.notes||'')}</textarea></label></fieldset>
    <fieldset><legend>لمستك الخاصة</legend><label><span>الخط العربي</span><select id="font"><option value="amiri" ${d.font==='amiri'?'selected':''}>أميري — نسخ رسمي</option><option value="ruqaa" ${d.font==='ruqaa'?'selected':''}>عارف رقعة — طابع فني</option><option value="tajawal" ${d.font==='tajawal'?'selected':''}>تجوال — عصري واضح</option></select></label><label><span>لون النص</span><select id="textColor">${t.textColors.map((c,i)=>`<option value="${c}" ${d.textColor===c?'selected':''}>${(t.tone==='dark'?['عاجي واضح','ذهبي فاتح','لؤلؤي']:['حبر داكن','بني رسمي','أخضر عميق'])[i]}</option>`).join('')}</select></label><small>ألوان مختارة للحفاظ على وضوح القراءة.</small><label><span>لون التفاصيل الزخرفية</span><input id="accent" type="color" value="${N.esc(d.accent)}"></label>${t.alignments.length>1?`<label><span>محاذاة النص</span><select id="alignment">${t.alignments.map(a=>`<option value="${a}" ${d.align===a?'selected':''}>${a==='right'?'يمين':'وسط'}</option>`).join('')}</select></label>`:''}<label class="wedding-ornament-toggle"><input type="checkbox" id="ornaments" ${d.ornaments?'checked':''}><span>إظهار اللمسات الزخرفية الإضافية</span></label></fieldset>
    ${t.customBackground?`<fieldset><legend>خلفية خاصة — اختياري</legend><label class="image-upload"><span>JPEG أو PNG أو WebP، حتى 10 ميجابايت</span><input id="designImage" type="file" accept="image/png,image/jpeg,image/webp"></label>${d.image?'<button type="button" id="removeImage" class="outline-btn dark-outline">استعادة خلفية القالب</button>':''}<small>تُضبط منطقة النص تلقائيًا لوضوح القراءة.</small></fieldset>`:'<p class="wedding-editor-note">يحافظ هذا التصميم على خلفيته الأصلية وتنسيقه المتوازن.</p>'}
    <label class="image-upload"><span>موسيقى الدعوة — اختياري</span><input id="designAudio" type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac"></label>${N.safeAudioUrl(d.audio)?`<audio controls preload="none" src="${N.esc(d.audio)}" aria-label="معاينة موسيقى الدعوة"></audio><button type="button" id="removeAudio">إزالة الموسيقى</button>`:''}
    <details class="wedding-switcher"><summary>مقارنة تصميم آخر</summary><div class="mini-template-switch">${templates().map(item=>`<button type="button" class="mini-template ${state.template===item.name?'selected':''}" data-template="${N.esc(item.name)}" aria-label="اختيار قالب ${N.esc(item.name)}">${thumb(item)}</button>`).join('')}</div></details>
  </div></div>`;
}
function parseGuests(){return state.guestText.split(/\r?\n/).map(line=>{const [name,...rest]=line.split(/[,،]/);return{name:name?.trim(),phone:rest.join(',').trim()}}).filter(x=>x.name)}
function renderGuests(){const count=parseGuests().length;return `${heading('عدد المدعوين وقائمتهم','حدّد العدد المطلوب للتسعير؛ يمكنك إضافة أسماء الضيوف لاحقًا')}${field('guestCount','عدد المدعوين المطلوب',state.guestCount,'number','min="1" max="5000" step="1" required')}<div class="guest-entry"><textarea id="guestText" rows="10" placeholder="محمد العتيبي، 0500000000\nخالد الحربي، 0500000001">${N.esc(state.guestText)}</textarea><div class="guest-entry-note"><span>${count} ضيف</span><small>يمكنك أيضًا الإضافة والاستيراد من لوحة المضيف بعد الإنشاء.</small></div></div>`}
function renderReview(){const count=parseGuests().length;return `${heading('راجع دعوتك','هذه المعاينة تستخدم نفس الرسم الذي سيصل للضيف')}<div class="review-grid"><div>${invitePreview()}<button type="button" class="guest-preview-link" data-full-preview>معاينة كضيف</button></div><div class="review-summary"><h3>${N.esc(state.name1)}${state.name2?' و '+N.esc(state.name2):''}</h3>${state.hostName?`<p>${N.esc(state.hostName)}</p>`:''}<dl><div><dt>النوع</dt><dd>${N.esc(state.occasionKey==='activity'?activityLabel():occasion().label)}</dd></div><div><dt>التاريخ</dt><dd>${N.esc(state.date)}</dd></div><div><dt>الموقع</dt><dd>${N.esc(state.location)}</dd></div><div><dt>القالب</dt><dd>${N.esc(state.template)}</dd></div><div><dt>الضيوف</dt><dd>${count}</dd></div>${state.occasionKey==='activity'?`<div><dt>القطّة</dt><dd>${Number(state.shareAmount||0).toLocaleString('ar-SA')} ر.س للفرد</dd></div>`:''}</dl></div></div>`}
function supervisorChoice(){
  return `<fieldset class="supervisor-gender-choice"><legend>تفضيلك لخدمة الاستقبال</legend><label><input type="radio" name="supervisorPreference" value="male" ${state.supervisorPreference==='male'?'checked':''}> مشرف</label><label><input type="radio" name="supervisorPreference" value="female" ${state.supervisorPreference==='female'?'checked':''}> مشرفة</label><small>يُراجع التوفر حسب المدينة والموعد قبل تأكيد التكليف.</small></fieldset>`;
}
function renderSend(){
  const sp=Number(window.HALA_AUTH?.supervisorPrice??599);
  return `${heading('تأكيد طلب الحجز','راجع السعر وأدخل بيانات التواصل. لا يتم تحصيل أي مبلغ الآن.')}<div class="send-card booking-checkout"><div class="package-row">${catalogPackages.map(p=>`<button type="button" data-package="${N.esc(p.name)}" class="${state.package===p.name?'selected':''}">${N.esc(p.name)} <small>${H.money(p.amount)} • حتى ${p.guestLimit} ضيف</small></button>`).join('')}</div>${field('guestCount','عدد المدعوين المطلوب',state.guestCount,'number','min="1" max="5000" step="1" required')}<label class="supervisor-addon"><input id="requestSupervisor" type="checkbox" ${state.requestSupervisor?'checked':''}><span><b>إضافة مشرف أو مشرفة</b><small>يُراجع التوفر قبل التأكيد النهائي</small></span><strong>+${sp.toLocaleString('ar-SA')} ر.س</strong></label>${state.requestSupervisor?supervisorChoice():''}<label class="journey-field"><span>كود القاعة أو المؤثر (اختياري)</span><input id="referralCode" maxlength="24" value="${N.esc(state.referralCode||localStorage.getItem('halaReferralCode')||'')}" autocomplete="off"></label><button type="button" id="refreshBookingQuote" class="outline-btn dark-outline">تحديث السعر وتطبيق الكود</button><div id="bookingQuote" class="checkout-summary" aria-live="polite"><span>جاري حساب السعر من هلا…</span></div><div class="journey-form contact-details">${field('contactName','اسم العميل',state.contactName,'text','autocomplete="name" maxlength="120" required')}${field('contactPhone','رقم الجوال',state.contactPhone,'tel','autocomplete="tel" inputmode="tel" required')}${field('contactEmail','البريد الإلكتروني (اختياري)',state.contactEmail,'email','autocomplete="email" maxlength="180"')}<label class="journey-check"><input id="marketingConsent" type="checkbox" ${state.marketingConsent?'checked':''}><span>أوافق اختياريًا على استقبال أخبار وعروض هلا. الحجز متاح دون هذه الموافقة.</span></label></div><p class="booking-notice">هذه خطوة تأكيد طلب حجز مبدئي دون دفع. سيُحفظ الطلب أولًا ثم يتواصل معك الفريق لاستكمال الدفع والتأكيد النهائي.</p><a href="${H.whatsapp()}" data-hala-support target="_blank" rel="noopener noreferrer">تحتاج مساعدة؟ تواصل مع خدمة العملاء — اختياري</a></div>`;
}
async function updateBookingQuote(){
  if(state.step!==7)return;
  saveInputs();const revision=++quoteRevision;checkoutQuote=null;
  const element=$('#bookingQuote',body);if(!element)return;
  element.innerHTML='<span>جاري حساب السعر من هلا…</span>';
  nextBtn.disabled=true;
  try{
    const selected=catalogPackages.find(p=>p.name===state.package);
    const data=await H.api('/api/bookings/quote',{method:'POST',body:JSON.stringify({packageCode:selected?.code,guestCount:Number(state.guestCount),services:state.requestSupervisor?['supervisor']:[],supervisorPreference:state.supervisorPreference,referralCode:state.referralCode||''})});
    if(revision!==quoteRevision||state.step!==7)return;
    checkoutQuote=data.quote;
    element.innerHTML=`<span>الباقة ${H.money(data.quote.baseAmount)}</span><span>الخدمات ${H.money(data.quote.addonAmount)}</span><span>الخصم ${H.money(data.quote.discountAmount)}</span><strong>الإجمالي النهائي ${H.money(data.quote.total)}</strong><small>لا يتم الدفع الآن — تأكيد نهائي بعد التواصل</small>`;
    track('price_viewed',{package:selected?.code});
  }catch(error){if(revision===quoteRevision&&state.step===7)element.innerHTML=`<span role="alert">${N.esc(error.message)}</span>`;}
  finally{if(revision===quoteRevision)nextBtn.disabled=submittingBooking||!checkoutQuote;}
}
function render(){
  $('.builder-progress').style.display='none';let content='';
  if(state.step===1)content=state.activityPicking?renderActivities():`${heading('اختر نوع المناسبة','كل لحظة تستحق دعوة أجمل')}${renderOccasions()}`;
  if(state.step===2)content=renderDetails();if(state.step===3)content=renderTemplates();if(state.step===4)content=renderDesign();if(state.step===5)content=renderGuests();if(state.step===6)content=renderReview();if(state.step===7)content=renderSend();
  body.innerHTML=`${progress()}<div class="journey-save-state"><span>${draftSaveFailed?'تعذر حفظ المسودة على الجهاز؛ احتفظ بالصفحة مفتوحة':'✓ محفوظ تلقائيًا'}</span><b>الخطوة ${state.step} من ${stages.length}</b></div><div class="journey-content">${content}</div>`;body.scrollTop=0;prevBtn.style.visibility=state.step===1&&!state.activityPicking?'hidden':'visible';nextBtn.textContent=state.step===7?'تأكيد طلب الحجز':'التالي ←';nextBtn.disabled=submittingBooking;bind();if(state.step===7)updateBookingQuote();requestAnimationFrame(()=>$('.journey-step.active',body)?.scrollIntoView({block:'nearest',inline:'center'}));
}
function bind(){
  $$('[data-occasion]',body).forEach(b=>b.onclick=()=>{saveInputs();state.occasionKey=b.dataset.occasion;track('occasion_selected',{occasion:state.occasionKey});state.customOccasion='';cleanTypeFields();applyTypeExperience();state.activityPicking=state.occasionKey==='activity';if(!state.activityPicking)state.template=templates()[0].name;state.design.templateId=N.templateByName(state.template,groupKey()).id||'';saveDraft();render()});
  $$('[data-activity]',body).forEach(b=>b.onclick=()=>{saveInputs();state.activityKey=b.dataset.activity;state.template=templates()[0].name;state.design.templateId='';saveDraft();render()});
  $$('[data-template]',body).forEach(b=>b.onclick=()=>setTemplate(b.dataset.template));
  $$('[data-builder-filter]',body).forEach(b=>b.onclick=()=>{saveInputs();weddingFilter=b.dataset.builderFilter;render();$('[data-builder-filter="'+weddingFilter+'"]',body)?.focus()});
  bindTemplatePreviews(body);
  $$('[data-package]',body).forEach(b=>b.onclick=()=>{saveInputs();state.package=b.dataset.package;track('package_viewed',{package:state.package});saveDraft();render()});
  $$('[data-full-preview]',body).forEach(b=>b.onclick=()=>{saveInputs();openFullPreview(selectedTemplate(),b)});
  $('#requestSupervisor',body)?.addEventListener('change',()=>{saveInputs();render()});
  $$('input[name="supervisorPreference"]',body).forEach(radio=>radio.onchange=e=>{state.supervisorPreference=e.target.value;saveDraft();render()});
  $('#refreshBookingQuote',body)?.addEventListener('click',updateBookingQuote);
  ['guestCount','referralCode'].forEach(id=>$('#'+id,body)?.addEventListener('change',updateBookingQuote));
  let contactTracked=false;['contactName','contactPhone','contactEmail'].forEach(id=>$('#'+id,body)?.addEventListener('input',()=>{if(!contactTracked){track('contact_started');contactTracked=true}}));
  const font=$('#font',body);if(font)font.value=state.design.font;
  $('#designImage',body)?.addEventListener('change',handleImage);
  $('#designAudio',body)?.addEventListener('change',handleAudio);
  $('#removeImage',body)?.addEventListener('click',()=>{state.design.image='';saveDraft();render()});
  $('#removeAudio',body)?.addEventListener('click',()=>{state.design.audio='';saveDraft();render()});
  $$('input:not([type=file]),textarea,select',body).forEach(el=>el.addEventListener('input',()=>{saveInputs();if(state.step===4)scheduleInvitationPreview()}));
}
function saveInputs(){
  ['customOccasion','customActivity','name1','name2','hostName','date','time','location','city','mapsUrl','message','description','capacity','shareAmount','guestText','guestCount','contactName','contactPhone','contactEmail','referralCode'].forEach(k=>{const el=$('#'+k,body);if(el)state[k]=el.value});
  ['requireShareConsent','allowNamedCompanions','waitlistEnabled','requestSupervisor','marketingConsent'].forEach(k=>{const el=$('#'+k,body);if(el)state[k]=el.checked});
  for(const [id,key]of Object.entries({font:'font',headline:'headline',accent:'accent',textColor:'textColor',alignment:'align',eventTitleInput:'eventTitle',designNotes:'notes'})){const el=$('#'+id,body);if(el)state.design[key]=el.value}
  const ornaments=$('#ornaments',body);if(ornaments)state.design.ornaments=ornaments.checked;
  const t=N.templateByName(state.template,groupKey());
  if(t.version===2)state.design=N.normalizeWeddingDesign(t,state.design);else state.design.templateId='';
  saveDraft();
}
let previewFramePending=false;
function scheduleInvitationPreview(){if(previewFramePending)return;previewFramePending=true;requestAnimationFrame(()=>{previewFramePending=false;const current=$('.host-phone .invite-canvas',body);if(!current)return;const fragment=document.createElement('template');fragment.innerHTML=N.canvas({...state,occasion:eventLabel()});const updated=fragment.content.firstElementChild;if(current.classList.contains('wedding-v2')&&updated.classList.contains('wedding-v2')){for(const attr of updated.attributes)current.setAttribute(attr.name,attr.value);$('.wedding-copy',current).replaceWith($('.wedding-copy',updated));}else current.replaceWith(updated);});}

function validUrl(v){if(!v)return true;try{return['https:','http:'].includes(new URL(v).protocol)}catch{return false}}
function validate(){if(state.step===7&&state.requestSupervisor&&!['male','female'].includes(state.supervisorPreference))return'اختر مشرفًا أو مشرفة قبل المتابعة';if(state.step===1&&state.occasionKey==='custom'&&!state.customOccasion.trim())return'اكتب اسم المناسبة';if(state.step===1&&state.activityPicking&&state.activityKey==='activityCustom'&&!state.customActivity.trim())return'اكتب اسم النشاط';if(state.step===2){const schema=window.HALA_V6_SCHEMA?.schemaFor(state.occasionKey);for(const f of (schema?.fields||[])){if(f.required&&!String(state[f.key]||'').trim())return 'أكمل حقل: '+f.label}if(!validUrl(state.mapsUrl))return'رابط الموقع غير صالح';if(state.occasionKey==='activity'&&Number(state.capacity)<1)return'أدخل سعة صحيحة'}return''}
async function handleImage(e){
  const file=e.target.files?.[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)return toast('اختر صورة JPEG أو PNG أو WebP أقل من 10 ميجابايت');
  const t=selectedTemplate();if(t.version===2&&!t.customBackground)return toast('هذا القالب يحتفظ بخلفيته الأصلية');
  const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const valid=file.type==='image/jpeg'?signature[0]===255&&signature[1]===216&&signature[2]===255:file.type==='image/png'?[137,80,78,71,13,10,26,10].every((b,i)=>signature[i]===b):String.fromCharCode(...signature.slice(0,4))==='RIFF'&&String.fromCharCode(...signature.slice(8,12))==='WEBP';
  if(!valid)return toast('محتوى الملف لا يطابق صيغة الصورة');
  const url=URL.createObjectURL(file),img=new Image();
  img.onerror=()=>{URL.revokeObjectURL(url);toast('تعذر قراءة الصورة')};
  img.onload=()=>{try{if(img.width*img.height>20000000)throw Error('اختر صورة أقل من 20 ميجابكسل');const scale=Math.min(1,1400/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const image=canvas.toDataURL('image/jpeg',.78);if(image.length>600000)throw Error('الصورة كبيرة؛ اختر صورة أصغر');state.design.image=image;saveDraft();render()}catch(error){toast(error.message||'تعذر تجهيز الصورة')}finally{URL.revokeObjectURL(url)}};img.src=url;
}
function handleAudio(e){const file=e.target.files?.[0];if(!file)return;if(!['audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/aac'].includes(file.type)||file.size>600*1024)return toast('اختر ملف صوت أقل من 600 كيلوبايت');const reader=new FileReader();reader.onload=()=>{const audio=N.safeAudioUrl(reader.result);if(!audio)return toast('صيغة الملف غير مدعومة');state.design.audio=audio;saveDraft();render()};reader.onerror=()=>toast('تعذر قراءة الصوت');reader.readAsDataURL(file)}
function bindTemplatePreviews(root){$$('[data-template-preview]',root).forEach(b=>b.onclick=()=>{saveInputs();openFullPreview(N.templateByName(b.dataset.templatePreview,'wedding'),b,b.dataset.previewContext)})}
function closeFullPreview(){const overlay=$('#journeyFullPreview');if(!overlay)return;overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');modal.inert=false;previewOrigin?.focus();previewData=null;}
function openFullPreview(t=selectedTemplate(),origin=document.activeElement,context='builder'){
  previewOrigin=origin;previewIsFull=false;const isWedding=N.catalog.wedding.includes(t);
  previewData={...state,occasionKey:isWedding?'wedding':state.occasionKey,occasion:isWedding?'زواج':eventLabel(),name1:state.name1||'محمد',name2:state.name2||'نورة',template:t.name,design:t.version===2?N.normalizeWeddingDesign(t,{...state.design,templateId:t.id,accent:t.accent}):{...state.design,templateId:''}};
  let overlay=$('#journeyFullPreview');if(!overlay){overlay=document.createElement('div');overlay.id='journeyFullPreview';overlay.className='journey-full-preview';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','معاينة قالب الدعوة');document.body.appendChild(overlay)}
  overlay.innerHTML=`<button type="button" data-preview-close aria-label="إغلاق المعاينة">×</button><div class="wedding-preview-toolbar"><strong>${N.esc(t.name)}</strong><div role="group" aria-label="حجم المعاينة"><button type="button" data-preview-mode="mobile" aria-pressed="true">الجوال</button><button type="button" data-preview-mode="full" aria-pressed="false">النسخة الكاملة</button></div><button type="button" data-preview-select>اختيار هذا القالب</button></div><div class="full-preview-phone">${N.canvas(previewData,{guestName:'ضيف هلا'})}</div>`;
  overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');modal.inert=true;
  $('[data-preview-close]',overlay).onclick=closeFullPreview;
  $('[data-preview-select]',overlay).onclick=()=>{closeFullPreview();if(context==='landing')selectLandingTemplate(t.name);else setTemplate(t.name)};
  $$('[data-preview-mode]',overlay).forEach(b=>b.onclick=()=>{previewIsFull=b.dataset.previewMode==='full';overlay.classList.toggle('preview-full',previewIsFull);$$('[data-preview-mode]',overlay).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('.full-preview-phone',overlay).innerHTML=N.canvas(previewData,{guestName:'ضيف هلا',fullImage:previewIsFull})});
  overlay.onkeydown=e=>{if(e.key!=='Tab')return;const focusables=$$('button',overlay),first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}};
  $('[data-preview-close]',overlay).focus();
}
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
    const result=await H.api('/api/bookings',{method:'POST',body:JSON.stringify({eventId:state.createdEvent.id,ownerToken:state.createdEvent.ownerToken,idempotencyKey:state.bookingIdempotencyKey,accessToken:state.bookingAccessToken,contact:{name:state.contactName.trim(),phone:state.contactPhone.trim(),email:state.contactEmail.trim()},guestCount:Number(state.guestCount),services:state.requestSupervisor?['supervisor']:[],supervisorPreference:state.supervisorPreference,referralCode:state.referralCode||'',...H.context(),marketingConsent:state.marketingConsent,expectedTotal:checkoutQuote?.total})});
    H.remember(result.booking,result.accessToken||state.bookingAccessToken);
    localStorage.removeItem('noortoonaDraftV55');
    const booking=result.booking;
    body.innerHTML=`<section class="booking-success" role="status"><img class="auth-logo" src="/assets/brand/hala-logo-dark.svg?v=20261102" alt="هلا HALA"><h2>تم تسجيل طلب حجزك بنجاح! ✨</h2><p>شكرًا لاختيارك هلا.</p><p>تم استلام تفاصيل مناسبتك وحفظ طلبك برقم:</p><strong class="booking-number">${N.esc(booking.booking_number)}</strong><p>سيتواصل معك فريق هلا قريبًا لاستكمال إجراءات الدفع والتأكيد النهائي.</p><p>يمكنك متابعة تفاصيل طلبك من حسابك في هلا.</p><p class="booking-notice">تسجيل الطلب لا يعني إتمام الدفع أو اعتماد الحجز النهائي.</p><div class="event-actions"><a class="gold-btn" href="/booking.html?id=${encodeURIComponent(booking.id)}">عرض حجزي</a><a class="outline-btn dark-outline" href="${H.whatsapp(booking.booking_number)}" target="_blank" rel="noopener noreferrer">التواصل مع خدمة العملاء</a></div><p>لحظتك .. تبدأ بهلا 🤍</p></section>`;
    nextBtn.style.display='none';prevBtn.style.display='none';
    // Guest list import is a separate optional operation; booking remains saved if it fails.
    const guests=parseGuests();
    if(guests.length){try{await H.api('/api/guests',{method:'POST',headers:{'x-noortoona-owner-token':state.createdEvent.ownerToken},body:JSON.stringify({eventId:state.createdEvent.id,guests})});}catch{toast('حُفظ الحجز. يمكنك إكمال إضافة المدعوين من لوحة المناسبة لاحقًا.');}}
  }catch(error){toast(error.message);nextBtn.disabled=false;nextBtn.textContent='تأكيد طلب الحجز';}
  finally{submittingBooking=false;}
}
nextBtn.onclick=async()=>{saveInputs();const error=validate();if(error)return toast(error);if(state.step===1&&state.activityPicking){state.activityPicking=false;state.step=2;saveDraft();render();return}if(state.step<7){state.step++;saveDraft();render();return}await createEvent()};prevBtn.onclick=()=>{saveInputs();if(state.step===1&&state.activityPicking){state.activityPicking=false;saveDraft();render();return}if(state.step>1){state.step--;saveDraft();render()}};
$$('[data-start]').forEach(b=>b.onclick=()=>openBuilder(state.occasionKey));$$('[data-close]').forEach(b=>b.onclick=closeBuilder);document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#journeyFullPreview')?.classList.contains('open'))closeFullPreview();else closeBuilder()}});
function selectLandingTemplate(name){openBuilder('wedding');setTemplate(name);state.step=2;saveDraft();render()}
function renderLandingWeddingGallery(){
  const tg=$('#templateGrid');if(!tg)return;
  tg.classList.add('wedding-library');
  const items=N.filterTemplates(N.templateChoices('wedding',hiddenTemplateKeys),landingWeddingFilter);
  tg.innerHTML=`${weddingFilterBar(landingWeddingFilter,'landing')}<p class="wedding-result-count" role="status">${items.length} قالب زواج متاح</p><div class="wedding-landing-grid">${weddingCards(items,'landing')||'<p>لا توجد قوالب متاحة في هذا التصنيف حاليًا.</p>'}</div>`;
  $$('[data-landing-filter]',tg).forEach(b=>b.onclick=()=>{landingWeddingFilter=b.dataset.landingFilter;renderLandingWeddingGallery();$('[data-landing-filter="'+landingWeddingFilter+'"]',tg)?.focus()});
  $$('[data-land-template]',tg).forEach(b=>b.onclick=()=>selectLandingTemplate(b.dataset.landTemplate));bindTemplatePreviews(tg);
}
document.addEventListener('load',e=>{const frame=e.target?.closest?.('.wedding-thumbnail');if(frame&&e.target.tagName==='IMG'){frame.dataset.imageState='loaded';const status=$('.thumbnail-status',frame);if(status)status.textContent=''}},true);
document.addEventListener('error',e=>{const image=e.target,frame=image?.closest?.('.wedding-thumbnail');if(!frame||image.tagName!=='IMG')return;if(!image.dataset.fallbackAttempted){image.dataset.fallbackAttempted='true';$('source',frame)?.remove();return}frame.dataset.imageState='error';const status=$('.thumbnail-status',frame);if(status)status.textContent='تعذر تحميل الصورة — يمكنك فتح المعاينة'},true);
function renderLanding(){
  const grid=$('#occasionGrid');
  if(grid)grid.innerHTML=N.occasions.map(o=>`<button class="occasion-card" data-land-occasion="${o.key}"><span class="occasion-icon">${o.icon}</span><strong>${o.label}</strong><small>ابدأ الآن</small></button>`).join('');
  $$('[data-land-occasion]').forEach(b=>b.onclick=()=>openBuilder(b.dataset.landOccasion));
  renderLandingWeddingGallery();
  const prices=catalogPackages.map(p=>({name:p.name,guests:`حتى ${p.guestLimit} ضيف`,price:p.amountSar,reference:p.promoLicenseId&&Number.isFinite(p.referenceAmountSar)&&p.referenceAmountSar>p.amountSar?p.referenceAmountSar:0,featured:p.code==='hala_plus',items:p.code==='hala_basic'?['قوالب دعوات قابلة للتخصيص','رابط الدعوة وموقع المناسبة','إدارة التأكيد والاعتذار']:p.code==='hala_plus'?['كل مزايا الأساسية','إرسال واتساب عند تفعيل الخدمة','QR لكل ضيف','لوحة متابعة المدعوين']:['كل مزايا بلس','تخصيصات متقدمة','قوائم انتظار وتقارير حضور','أولوية الدعم حسب التوفر']}));
  const pg=$('#priceGrid');
  if(pg)pg.innerHTML=prices.map(p=>`<article class="price-card ${p.featured?'featured':''}">${p.featured?'<span class="price-tag">خيارنا المقترح</span>':''}<h3>${p.name}</h3><p>${p.guests}</p>${p.reference?`<div class="price-previous">السعر السابق الموثق <del>${p.reference.toLocaleString("ar-SA")} ريال</del></div><span class="verified-promo">السعر بعد التخفيض المرخّص</span>`:""}<div class="price-number">${Number(p.price).toLocaleString("ar-SA")}<small> ريال</small></div><ul>${p.items.map(i=>`<li>${i}</li>`).join('')}</ul><button type="button" class="gold-btn" data-land-package="${p.name}" style="width:100%">اختر الباقة</button></article>`).join('');
  $$('[data-land-package]').forEach(b=>b.onclick=()=>{state.package=b.dataset.landPackage;track('package_viewed',{package:state.package});openBuilder(state.occasionKey)});
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
  catalogPackages=catalog.packages;hiddenTemplateKeys=catalog.hiddenTemplateKeys;catalogServices=catalog.services;
  if(!catalogPackages.some(p=>p.name===state.package))state.package=catalogPackages[0].name;
  if(!templates().some(t=>t.name===state.template)&&templates()[0])state.template=templates()[0].name;
  renderLanding();
  if(modal.classList.contains('open')&&[3,4,7].includes(state.step)){saveInputs();render()}
}).catch(()=>{});
