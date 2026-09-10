const code = new URLSearchParams(location.search).get('code') || location.pathname.split('/').filter(Boolean).pop();
const card = document.getElementById('inviteCard');
let currentInvite = null;
let currentShareAmount = 0;
const esc = s => String(s ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const safeExternalUrl = value => { try { const url=new URL(String(value||'')); return ['https:','http:'].includes(url.protocol)?url.href:''; } catch { return ''; } };
const fmtDate = v => { if(!v) return ''; const d=new Date(v); return new Intl.DateTimeFormat('ar-SA',{dateStyle:'long'}).format(d); };
const templateThemes = {
  'ليلة مخملية':['linear-gradient(155deg,#071625,#02070c)','#d9b651','dark'],
  'لؤلؤة العروس':['linear-gradient(155deg,#fffaf3,#ead9bd)','#9b7440','light'],
  'ورد أبيض':['linear-gradient(155deg,#fff9f7,#ead7d3)','#a06f6a','light'],
  'قاعة ملكية':['linear-gradient(155deg,#15233a,#070b12)','#e0bd65','dark'],
  'ذهبي ناعم':['linear-gradient(155deg,#f6eddc,#d4b773)','#5f4321','light'],
  'حروف الحب':['linear-gradient(155deg,#351a22,#10070a)','#e5bd8f','dark'],
  'ملكتنا':['linear-gradient(155deg,#24162e,#09050d)','#dfbd70','dark'],
  'خاتم ذهبي':['linear-gradient(155deg,#fff8e9,#e5cf9e)','#8a642a','light'],
  'ليلة الملكة':['linear-gradient(155deg,#0c2630,#031013)','#d7ba68','dark'],
  'ورد ملكي':['linear-gradient(155deg,#f9eceb,#d9b8b3)','#8f5e60','light'],
  'مخملي عنابي':['linear-gradient(155deg,#4a1022,#16040a)','#e2c07b','dark'],
  'قبعة النجاح':['linear-gradient(155deg,#10253c,#050b12)','#e0bd65','dark'],
  'أهلًا صغيرنا':['linear-gradient(155deg,#eef7fb,#cddfe7)','#628292','light'],
  'أهلًا صغيرتنا':['linear-gradient(155deg,#fff2f4,#e8cdd2)','#9a6b76','light'],
  'شموع':['linear-gradient(155deg,#32182f,#0d0610)','#edc16f','dark'],
  'رسمي ملكي':['linear-gradient(155deg,#0b1f3a,#030812)','#d4af37','dark'],
  'ملعب ليلي':['linear-gradient(180deg,#07140d 0%,#0d3b24 55%,#07140d 100%)','#f2d06b','dark'],
  'تحت الكشافات':['radial-gradient(circle at 50% 8%,#d7f8b633 0 10%,transparent 28%),linear-gradient(160deg,#071016,#122a1c)','#d8ef75','dark'],
  'ديربي الأصحاب':['linear-gradient(145deg,#122338,#07101a)','#e6c66a','dark'],
  'Kick Off':['linear-gradient(145deg,#0c2117,#030a06)','#e9f08a','dark'],
  'Padel Night':['linear-gradient(145deg,#132c2d,#071112)','#d9dc6f','dark'],
  'الملعب الزجاجي':['linear-gradient(145deg,#153b42,#07151a)','#e2cd75','dark'],
  'بادل مودرن':['linear-gradient(145deg,#24253b,#0b0c16)','#d8e86c','dark'],
  'Match Point':['linear-gradient(145deg,#203729,#09130d)','#efe18a','dark'],
  'ليلة البر':['linear-gradient(180deg,#101727 0%,#2c1d12 58%,#120b07 100%)','#f0c276','dark'],
  'نار ومسامر':['radial-gradient(circle at 50% 78%,#e58c3f55,transparent 22%),linear-gradient(180deg,#111a29,#21130b)','#efc17c','dark'],
  'مخيم النجوم':['linear-gradient(180deg,#071427,#1f1a19)','#e8cf8c','dark'],
  'صحراء هادئة':['linear-gradient(180deg,#1c2430,#6c4b2c)','#f1d39a','dark'],
  'جلسة الأصحاب':['linear-gradient(145deg,#302519,#120c07)','#e8c27c','dark'],
  'ليلة الاستراحة':['linear-gradient(145deg,#18352e,#08140f)','#dec47b','dark'],
  'Gathering':['linear-gradient(145deg,#292237,#0f0b16)','#e2c98a','dark'],
  'طريقنا':['linear-gradient(180deg,#123a52,#18251d)','#f0d28a','dark'],
  'رحلة الأصحاب':['linear-gradient(145deg,#163b4a,#0b171d)','#d9c77f','dark'],
  'مغامرة':['linear-gradient(145deg,#29412f,#0b1510)','#e8d28b','dark'],
  'عشاء خاص':['linear-gradient(145deg,#341c1c,#110707)','#e7c38d','dark'],
  'طاولة المساء':['linear-gradient(145deg,#242424,#090909)','#e1bf77','dark'],
  'Dinner Night':['linear-gradient(145deg,#1f2434,#090b11)','#e8c883','dark']
};
function themeFor(name){ return templateThemes[name] || ['linear-gradient(155deg,#15141e,#08070c)','#eacea0','dark']; }
const designBackgrounds={midnight:'linear-gradient(145deg,#15141e,#07070b)',navy:'linear-gradient(145deg,#0b1f3a,#030812)',burgundy:'linear-gradient(145deg,#431322,#120509)',ivory:'linear-gradient(145deg,#fbf6ec,#eadcc3)'};
const designFonts={ruqaa:'Aref Ruqaa',tajawal:'Tajawal',serif:'Georgia'};
function normalizeDesign(v){ if(!v)return {}; if(typeof v==='object')return v; try{return JSON.parse(v)}catch{return {}} }


function activityArtKey(i){
  const text=`${i?.activity_type||''} ${i?.template||''} ${i?.occasion||''}`.toLowerCase();
  if(/بادل|padel/.test(text)) return 'padel';
  if(/كشت|مخيم|بر|طلعة/.test(text)) return 'camp';
  if(/رحلة|سفر/.test(text)) return 'trip';
  if(/عشاء|مطعم|استراحة/.test(text)) return 'gathering';
  if(/كرة|ملعب|match|football/.test(text)) return 'football';
  if(/زواج|ملكة|خطوبة/.test(text)) return 'wedding';
  if(/تخرج/.test(text)) return 'graduation';
  if(/مولود/.test(text)) return 'baby';
  if(/ميلاد/.test(text)) return 'birthday';
  if(/عزاء/.test(text)) return 'condolence';
  return 'event';
}

async function loadInvite(){
  try{
    const res=await fetch(`/api/invite?code=${encodeURIComponent(code)}`); const data=await res.json();
    if(!res.ok) throw new Error(data.error||'تعذر فتح الدعوة');
    const i=data.invite; currentInvite=i; const isActivity=i.occasion==='تجمع ونشاط'; const shareAmount=Number(i.share_amount||0); currentShareAmount=shareAmount;
    const design=normalizeDesign(i.design_json);
    const mapsUrl=safeExternalUrl(i.maps_url), videoUrl=safeExternalUrl(i.video_url), pdfUrl=safeExternalUrl(i.pdf_url);
    const [templateBg,templateFg,tone]=themeFor(i.template);
    const bg=designBackgrounds[design.background]||templateBg, fg=design.accent||templateFg;
    card.style.setProperty('--invite-bg',bg); card.style.setProperty('--invite-fg',fg); card.style.setProperty('--invite-font',designFonts[design.font]||'Aref Ruqaa');
    if(design.image){card.style.setProperty('--invite-image',`url(\"${design.image}\")`);card.classList.add('has-custom-image')}
    card.dataset.tone=tone; card.dataset.layout=design.layout||'classic'; card.dataset.effect=design.effect||'sweep'; card.dataset.frame=design.frame||'fine';
    const occasionKey=design.occasionKey||(isActivity?'activity':activityArtKey(i)==='wedding'?'wedding':activityArtKey(i)==='graduation'?'graduation':activityArtKey(i)==='baby'?'newborn':activityArtKey(i)==='birthday'?'birthday':activityArtKey(i)==='condolence'?'condolence':'custom');
    const activityKey=design.activityKey||(/بادل/i.test(i.activity_type||'')?'padel':/كشت/i.test(i.activity_type||'')?'camp':/استراحة|شاليه/i.test(i.activity_type||'')?'chalet':/رحلة/i.test(i.activity_type||'')?'trip':/عشاء/i.test(i.activity_type||'')?'dinner':'football');
    card.innerHTML=window.NOORTOONA.canvas({...i,date:i.event_date,time:i.event_time,occasionKey,activityKey,activityType:i.activity_type,design},{guestName:i.guest_name})+`
      <div class="guest-light-sweep"></div>
      <div class="occasion-art art-${activityArtKey(i)}" aria-hidden="true"></div>
      <span class="guest-brand">✦ نورتونا <small>NOORTOONA</small></span>
      <span class="guest-occasion">${esc(i.occasion)}</span>
      <p class="guest-for">دعوة خاصة إلى <strong>${esc(i.guest_name)}</strong></p>
      <div class="guest-frame">
        <span class="guest-frame-star">✦</span>
        <p class="guest-headline">${esc(design.headline || 'بكل الحب ندعوكم')}</p><p class="guest-kicker">${esc(i.message || 'يسعدنا ويشرفنا حضوركم ومشاركتنا فرحتنا')}</p>
        <h1>${esc(i.name1)} ${i.name2?'<span>&</span> '+esc(i.name2):''}</h1>
        <div class="guest-rule"></div>
      </div>
      <div class="guest-meta">
        ${i.event_date?`<div><small>التاريخ</small><strong>${fmtDate(i.event_date)}</strong></div>`:''}
        ${i.event_time?`<div><small>الوقت</small><strong>${esc(String(i.event_time).slice(0,5))}</strong></div>`:''}
        ${i.location?`<div><small>المكان</small><strong>${esc(i.location)}</strong></div>`:''}
      </div>
      ${design.showCountdown!==false&&i.event_date?`<div class="guest-countdown" data-event-date="${esc(i.event_date)}" data-event-time="${esc(String(i.event_time||'00:00').slice(0,5))}"><small>متبقي على المناسبة</small><div><span><b data-days>0</b><i>يوم</i></span><span><b data-hours>0</b><i>ساعة</i></span><span><b data-minutes>0</b><i>دقيقة</i></span></div></div>`:''}
      ${i.description?`<p class="guest-description">${esc(i.description)}</p>`:''}
      ${design.showMap!==false&&mapsUrl?`<a class="outline-btn guest-map" target="_blank" rel="noopener" href="${esc(mapsUrl)}">⌖ فتح الموقع على الخريطة</a>`:''}
      ${(videoUrl||pdfUrl)?`<div class="guest-media-links">${videoUrl?`<a class="outline-btn" target="_blank" rel="noopener" href="${esc(videoUrl)}">▶ مشاهدة الفيديو</a>`:''}${pdfUrl?`<a class="outline-btn" target="_blank" rel="noopener" href="${esc(pdfUrl)}">PDF تفاصيل المناسبة</a>`:''}</div>`:''}
      ${design.showQr!==false?`<div class="guest-qr"><div><img alt="QR الدخول" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(location.href)}"><span>⌁</span></div><small>QR الخاص بالدعوة للدخول</small></div>`:''}
      <div class="guest-rsvp">
        <h2>${isActivity?'هل ستشاركنا النشاط؟':'هل ستشاركنا المناسبة؟'}</h2>${isActivity?`<div class="activity-summary"><strong>${esc(i.activity_type||'تجمع ونشاط')}</strong><span>${i.capacity?`العدد الأقصى: ${esc(i.capacity)} شخص`:''}</span>${shareAmount?`<b>${esc(i.share_label||'قيمة القطّة')}: ${shareAmount.toLocaleString('ar-SA')} ر.س لكل شخص</b>`:''}${i.attendance_state==='waitlist'?'<em class="waitlist-note">أنت حاليًا في قائمة الانتظار</em>':''}</div>`:''}
        <div class="guest-rsvp-actions"><button data-status="accepted" class="gold-btn">نعم، سأحضر</button>${design.showMaybe!==false?'<button data-status="maybe" class="outline-btn maybe-btn">ربما</button>':''}${design.showDecline!==false?'<button data-status="declined" class="outline-btn">أعتذر عن الحضور</button>':''}</div>
        <div id="companions" class="companions hidden"><div class="rsvp-extra-grid"><label>عدد المرافقين<select id="companionCount">${[0,1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>${!isActivity&&design.allowChildren!==false?`<label>عدد الأطفال<select id="childrenCount">${[0,1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>`:''}</div>${isActivity&&i.allow_named_companions?'<div id="companionNames" class="companion-names"></div>':''}${isActivity&&shareAmount?`<div id="shareCalc" class="share-calc">إجمالي القطّة: <strong>${shareAmount.toLocaleString('ar-SA')} ر.س</strong></div>`:''}${isActivity&&i.require_share_consent?'<label class="share-consent"><input id="shareConsent" type="checkbox"> أوافق على تحمل قطتي وقطّة المرافقين المسجلين معي.</label>':''}${design.allowNotes!==false?'<label class="rsvp-note-label">ملاحظة للمضيف<textarea id="guestNote" rows="2" maxlength="500" placeholder="حساسية غذائية، ملاحظة خاصة..."></textarea></label>':''}<button id="confirmRsvp" class="gold-btn">تأكيد الحضور</button></div>
        <p id="rsvpResult" class="rsvp-result"></p>
      </div>${design.photographyPermission?'<div class="guest-photo-permission">📷 حضورك يعني موافقتك على سياسة التصوير الخاصة بالمناسبة.</div>':''}`;
    if(i.rsvp_status !== 'pending') showResult(i.rsvp_status, i.companion_count, i.children_count);
    card.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>choose(b.dataset.status));
    const canvasActions=card.querySelectorAll('.invite-actions-demo button');
    if(canvasActions[0]) canvasActions[0].onclick=()=>choose('accepted');
    if(canvasActions[1]) canvasActions[1].onclick=()=>choose('declined');
    startCountdown();
  }catch(e){card.innerHTML=`<div class="guest-error"><h2>تعذر فتح الدعوة</h2><p>${esc(e.message)}</p></div>`;}
}
function choose(status){
  const i=currentInvite; const shareAmount=currentShareAmount;
  if(!i){ alert('تعذر تحميل بيانات الدعوة، حدّث الصفحة وحاول مرة أخرى'); return; }
  if(status==='accepted'){
    const panel=document.getElementById('companions'); if(!panel)return; panel.classList.remove('hidden');
    const cc=document.getElementById('companionCount');
    const refreshActivity=()=>{
      const n=Number(cc?.value||0); const names=document.getElementById('companionNames');
      if(names)names.innerHTML=Array.from({length:n},(_,x)=>`<label>اسم المرافق ${x+1}<input class="companion-name" maxlength="80" placeholder="اكتب اسم المرافق"></label>`).join('');
      const calc=document.getElementById('shareCalc'); if(calc)calc.innerHTML=`إجمالي القطّة: <strong>${(shareAmount*(1+n)).toLocaleString('ar-SA')} ر.س</strong>`;
    };
    if(cc)cc.onchange=refreshActivity; refreshActivity();
    const confirm=document.getElementById('confirmRsvp');
    if(confirm) confirm.onclick=async()=>{
      const consent=document.getElementById('shareConsent');
      const names=[...document.querySelectorAll('.companion-name')].map(x=>x.value.trim());
      if(consent&&!consent.checked){alert('وافق على تحمل قيمة القطّة قبل تأكيد الحضور');return;}
      if(i.allow_named_companions&&names.some(x=>!x)){alert('اكتب اسم كل مرافق قبل التأكيد');return;}
      confirm.disabled=true; const old=confirm.textContent; confirm.textContent='جاري التأكيد…';
      try{await sendRsvp('accepted',Number(cc?.value||0),Number(document.getElementById('childrenCount')?.value||0),document.getElementById('guestNote')?.value||'',names,Boolean(consent?.checked));}
      finally{confirm.disabled=false;confirm.textContent=old;}
    };
  } else if(status==='maybe') sendRsvp('maybe',0,0,'');
  else sendRsvp('declined',0,0,'');
}
async function sendRsvp(status,companionCount,childrenCount=0,note='',companionNames=[],shareConsent=false){
  const res=await fetch('/api/rsvp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,status,companionCount,childrenCount,note,companionNames,shareConsent})});
  const data=await res.json(); if(!res.ok){const msg=data.error||'تعذر تسجيل الرد'; alert(msg); throw new Error(msg);}
  showResult(data.guest.rsvp_status,data.guest.companion_count,data.guest.children_count,data.guest.attendance_state);
}
function showResult(status,count,children=0,attendanceState='normal'){
  const el=document.getElementById('rsvpResult'); if(!el)return;
  document.getElementById('companions')?.classList.add('hidden');
  el.textContent=status==='accepted'?(attendanceState==='waitlist'?`اكتمل العدد حاليًا، وتم تسجيلك في قائمة الانتظار${count?` مع ${count} مرافق` : ''} ⏳`:`تم تأكيد حضورك${count?` مع ${count} مرافق` : ''}${children?` و ${children} طفل` : ''} ✨`):status==='maybe'?'تم تسجيل ردك: ربما. يمكنك العودة وتحديث ردك لاحقًا.':'تم تسجيل اعتذارك، ونقدّر ردك.';
  el.className='rsvp-result show';
}
loadInvite();

function startCountdown(){
  const box=document.querySelector('.guest-countdown'); if(!box)return;
  const target=new Date(`${box.dataset.eventDate}T${box.dataset.eventTime||'00:00'}:00`);
  const tick=()=>{
    const diff=target-Date.now();
    if(!Number.isFinite(diff)||diff<=0){box.innerHTML='<strong>بدأت المناسبة ✨</strong>';return false}
    box.querySelector('[data-days]').textContent=Math.floor(diff/86400000);
    box.querySelector('[data-hours]').textContent=Math.floor(diff%86400000/3600000);
    box.querySelector('[data-minutes]').textContent=Math.floor(diff%3600000/60000);
    return true;
  };
  if(tick())setInterval(tick,60000);
}
