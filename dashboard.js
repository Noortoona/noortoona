const root=document.getElementById('dashRoot');
const saved=JSON.parse(localStorage.getItem('noortoonaOwner')||'null');
const qs=new URLSearchParams(location.search); const eventId=qs.get('event')||saved?.eventId; const token=qs.get('token')||saved?.ownerToken;
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
let dashboardData=null;
let filters={q:'',status:'all',view:'all'};
let importPreview=[];

async function load(){
 if(!eventId||!token){root.innerHTML='<div class="dash-empty"><h1>لا توجد مناسبة مرتبطة بهذا الجهاز</h1><p>أنشئ دعوتك أولًا من الصفحة الرئيسية.</p><a href="/" class="gold-btn">إنشاء دعوة</a></div>';return;}
 root.classList.add('is-loading');
 try{
  const res=await fetch(`/api/dashboard?event=${encodeURIComponent(eventId)}&token=${encodeURIComponent(token)}`); const data=await res.json();
  if(!res.ok){root.innerHTML=`<div class="dash-empty"><h1>تعذر فتح اللوحة</h1><p>${esc(data.error)}</p></div>`;return;}
  localStorage.setItem('noortoonaOwner',JSON.stringify({eventId,ownerToken:token})); dashboardData=data; render(data);
 }catch{root.innerHTML='<div class="dash-empty"><h1>تعذر الاتصال</h1><p>تحقق من الاتصال وحاول مرة أخرى.</p><button class="gold-btn" onclick="load()">إعادة المحاولة</button></div>'}
 finally{root.classList.remove('is-loading')}
}
function getFilteredGuests(guests){
 const q=filters.q.trim().toLowerCase();
 return guests.filter(g=>{
  const matchQ=!q || String(g.name||'').toLowerCase().includes(q) || String(g.phone||'').includes(q);
  const matchStatus=filters.status==='all' || (filters.status==='pending' ? !g.rsvp_status || g.rsvp_status==='pending' : g.rsvp_status===filters.status);
  const matchView=filters.view==='all' || (filters.view==='viewed'?!!g.viewed_at:!g.viewed_at);
  return matchQ&&matchStatus&&matchView;
 });
}
function statusLabel(g){return g.rsvp_status==='accepted'?'مؤكد':g.rsvp_status==='declined'?'معتذر':g.rsvp_status==='maybe'?'ربما':'بانتظار الرد'}
function waStatusLabel(g){return g.whatsapp_status==='read'?'مقروءة':g.whatsapp_status==='delivered'?'وصلت':g.whatsapp_status==='sent'?'أُرسلت':g.whatsapp_status==='failed'?'فشل الإرسال':'لم تُرسل'}
function parseCompanionNames(v){
 if(Array.isArray(v))return v.filter(Boolean);
 if(!v)return [];
 try{const x=JSON.parse(v);return Array.isArray(x)?x.filter(Boolean):[]}catch{return []}
}
function money(v){return Number(v||0).toLocaleString('ar-SA',{maximumFractionDigits:2})}
function paymentLabel(g){return g.payment_status==='paid'?'مدفوعة':'غير مدفوعة'}
function render({event,guests}){
 const isActivity=event.occasion==='تجمع ونشاط';
 const viewed=guests.filter(g=>g.viewed_at).length;
 const acceptedGuests=guests.filter(g=>g.rsvp_status==='accepted');
 const confirmed=acceptedGuests.filter(g=>g.attendance_state!=='waitlist');
 const waitlisted=acceptedGuests.filter(g=>g.attendance_state==='waitlist');
 const declined=guests.filter(g=>g.rsvp_status==='declined').length, maybe=guests.filter(g=>g.rsvp_status==='maybe').length;
 const accepted=acceptedGuests.length, pending=guests.length-accepted-declined-maybe;
 const companions=confirmed.reduce((n,g)=>n+(Number(g.companion_count)||0),0);
 const children=confirmed.reduce((n,g)=>n+(Number(g.children_count)||0),0);
 const expected=confirmed.length+companions+children;
 const waitlistPeople=waitlisted.reduce((n,g)=>n+1+(Number(g.companion_count)||0)+(Number(g.children_count)||0),0);
 const capacity=Number(event.capacity||0), spots=capacity?Math.max(0,capacity-expected):null;
 const due=confirmed.reduce((n,g)=>n+Number(g.share_total||0),0);
 const paid=confirmed.reduce((n,g)=>n+Number(g.payment_amount||0),0);
 const remaining=Math.max(0,due-paid);
 const list=getFilteredGuests(guests);
 const activityPanel=isActivity?`<section class="activity-dashboard">
   <div class="activity-dashboard-head"><div><span>⚡ إدارة النشاط</span><h2>${esc(event.activity_type||'تجمع ونشاط')}</h2></div><strong>${money(event.share_amount)} ر.س <small>للشخص</small></strong></div>
   <div class="activity-metrics">
    <div><small>المشاركون المؤكدون</small><b>${expected}</b></div>
    <div><small>الأماكن المتبقية</small><b>${spots===null?'∞':spots}</b></div>
    <div><small>قائمة الانتظار</small><b>${waitlistPeople}</b></div>
    <div><small>إجمالي القطّة</small><b>${money(due)} <i>ر.س</i></b></div>
    <div class="paid"><small>المحصّل</small><b>${money(paid)} <i>ر.س</i></b></div>
    <div class="remaining"><small>المتبقي</small><b>${money(remaining)} <i>ر.س</i></b></div>
   </div>
   ${capacity?`<div class="capacity-bar"><span style="width:${Math.min(100,(expected/capacity)*100)}%"></span></div><p>${expected} من ${capacity} مكان محجوز</p>`:''}
  </section>`:'';
 root.innerHTML=`<div class="dash-title-row"><div><span class="eyebrow dark">${isActivity?'لوحة منظم النشاط':'لوحة صاحب المناسبة'}</span><h1>${esc(event.title)}</h1><p>${esc(event.location||'')}</p></div><div class="dash-title-actions"><button id="refreshBtn" class="outline-btn dark-outline">↻ تحديث</button><button id="exportBtn" class="outline-btn dark-outline">↓ تصدير CSV</button></div></div>
 <div class="dash-stat-grid dash-stat-grid-7"><div><small>إجمالي الضيوف</small><strong>${guests.length}</strong></div><div><small>شاهدوا</small><strong>${viewed}</strong></div><div><small>أكدوا</small><strong>${accepted}</strong></div><div><small>ربما</small><strong>${maybe}</strong></div><div><small>بانتظار الرد</small><strong>${pending}</strong></div><div><small>اعتذروا</small><strong>${declined}</strong></div><div class="accent-stat"><small>${isActivity?'المشاركون الفعليون':'الحضور المتوقع'}</small><strong>${expected}</strong><em>مع المرافقين</em></div></div>
 ${activityPanel}
 <section class="dash-panel"><div class="panel-head"><div><h2>إدارة الضيوف</h2><p>أضف يدويًا أو استورد قائمة كاملة من Excel / CSV.</p></div><div class="panel-actions"><button id="importBtn" class="outline-btn dark-outline small-gold">⇧ استيراد Excel / CSV</button><button id="remindBtn" class="gold-btn small-gold">تذكير غير المستجيبين</button></div></div>
 <form id="guestForm" class="guest-form"><input name="name" placeholder="اسم الضيف" required><input name="phone" inputmode="tel" placeholder="رقم الجوال (اختياري)"><button class="gold-btn">+ إضافة ضيف</button></form>
 <div class="import-help"><span>صيغة الملف:</span> عمود للاسم، وعمود اختياري للجوال. نتعرف تلقائيًا على عناوين مثل <b>الاسم / Name</b> و <b>الجوال / Phone</b>.</div>
 <div class="guest-tools"><label class="search-box"><span>⌕</span><input id="guestSearch" value="${esc(filters.q)}" placeholder="ابحث بالاسم أو الجوال"></label><select id="statusFilter"><option value="all">كل حالات الرد</option><option value="accepted" ${filters.status==='accepted'?'selected':''}>مؤكد</option><option value="maybe" ${filters.status==='maybe'?'selected':''}>ربما</option><option value="pending" ${filters.status==='pending'?'selected':''}>بانتظار الرد</option><option value="declined" ${filters.status==='declined'?'selected':''}>معتذر</option></select><select id="viewFilter"><option value="all">كل المشاهدات</option><option value="viewed" ${filters.view==='viewed'?'selected':''}>شاهد الدعوة</option><option value="unviewed" ${filters.view==='unviewed'?'selected':''}>لم يفتح</option></select><span class="result-count">${list.length} ضيف</span></div>
 <div class="table-wrap"><table><thead><tr><th>الضيف</th><th>الرد</th><th>المشاهدة</th><th>المرافقون</th>${isActivity?'<th>أسماء المرافقين</th><th>القطّة</th><th>الدفع</th>':'<th>الأطفال</th><th>ملاحظة</th>'}<th>واتساب</th><th>الإجراءات</th></tr></thead><tbody>${list.length?list.map(g=>{
   const names=parseCompanionNames(g.companion_names);
   const wait=g.attendance_state==='waitlist';
   return `<tr class="${wait?'waitlist-row':''}"><td><strong>${esc(g.name)}</strong><small>${esc(g.phone||'بدون رقم')}</small></td><td><span class="status ${wait?'maybe':(g.rsvp_status||'pending')}">${wait?'قائمة انتظار':statusLabel(g)}</span></td><td><span class="view-state ${g.viewed_at?'seen':'unseen'}">${g.viewed_at?'● تمت المشاهدة':'○ لم يفتح'}</span></td><td>${g.rsvp_status==='accepted'?Number(g.companion_count||0):'—'}</td>${isActivity?`<td><small>${names.length?names.map(esc).join('، '):'—'}</small></td><td><strong>${g.rsvp_status==='accepted'?money(g.share_total)+' ر.س':'—'}</strong></td><td>${g.rsvp_status==='accepted'&&!wait?`<button class="payment-pill ${g.payment_status==='paid'?'paid':''}" data-payment-id="${esc(g.id)}" data-payment-status="${g.payment_status==='paid'?'unpaid':'paid'}">${paymentLabel(g)}</button>`:'—'}</td>`:`<td>${g.rsvp_status==='accepted'?Number(g.children_count||0):'—'}</td><td><small>${esc(g.note||'—')}</small></td>`}<td><span class="wa-state ${esc(g.whatsapp_status||'idle')}">${waStatusLabel(g)}</span></td><td><div class="invite-actions"><button class="copy-link" data-code="${esc(g.code)}">نسخ الرابط</button><button class="wa-link" data-code="${esc(g.code)}" data-phone="${esc(g.phone||'')}" data-name="${esc(g.name)}" data-id="${esc(g.id)}">واتساب</button><button class="delete-guest danger-link" data-id="${esc(g.id)}" data-name="${esc(g.name)}">حذف</button></div></td></tr>`
  }).join(''):`<tr><td colspan="${isActivity?10:8}" class="empty-row">لا يوجد ضيوف مطابقون للفلاتر.</td></tr>`}</tbody></table></div></section>`;
 bind(event,guests);
}
function bind(event,guests){
 document.getElementById('refreshBtn').onclick=load; document.getElementById('guestForm').onsubmit=addGuest; document.getElementById('exportBtn').onclick=()=>exportCSV(event,guests); document.getElementById('remindBtn').onclick=()=>openReminderQueue(event,guests); document.getElementById('importBtn').onclick=()=>document.getElementById('bulkGuestFile').click();
 const fileInput=document.getElementById('bulkGuestFile'); fileInput.onchange=async e=>{const file=e.target.files?.[0]; if(file)await parseGuestFile(file); e.target.value=''};
 document.getElementById('guestSearch').oninput=e=>{filters.q=e.target.value;render(dashboardData)};
 document.getElementById('statusFilter').onchange=e=>{filters.status=e.target.value;render(dashboardData)};
 document.getElementById('viewFilter').onchange=e=>{filters.view=e.target.value;render(dashboardData)};
 document.querySelectorAll('.copy-link').forEach(b=>b.onclick=()=>copyInvite(b.dataset.code)); document.querySelectorAll('.wa-link').forEach(b=>b.onclick=()=>sendWhatsApp(b.dataset.phone,b.dataset.name,b.dataset.code,event,false,b.dataset.id));
 document.querySelectorAll('.delete-guest').forEach(b=>b.onclick=()=>deleteGuest(b.dataset.id,b.dataset.name));
 document.querySelectorAll('.payment-pill').forEach(b=>b.onclick=()=>setPaymentStatus(b.dataset.paymentId,b.dataset.paymentStatus));
}
async function setPaymentStatus(guestId,paymentStatus){
 try{const res=await fetch('/api/guests',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({eventId,ownerToken:token,guestId,paymentStatus})});const data=await res.json();if(!res.ok)return toast(data.error||'تعذر تحديث الدفع');await load();toast(paymentStatus==='paid'?'تم تسجيل القطّة كمدفوعة ✓':'تم إرجاع حالة القطّة إلى غير مدفوعة');}catch{toast('تعذر تحديث حالة الدفع')}
}

async function addGuest(e){e.preventDefault();const fd=new FormData(e.target);const btn=e.submitter;btn.disabled=true;btn.textContent='جاري الإضافة…';
 const res=await fetch('/api/guests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId,ownerToken:token,name:fd.get('name'),phone:fd.get('phone')})});const data=await res.json();
 btn.disabled=false;btn.textContent='+ إضافة ضيف';if(!res.ok)return toast(data.error||'تعذر إضافة الضيف');e.target.reset();await load();toast('تمت إضافة الضيف وإنشاء رابطه الخاص ✨');}
async function deleteGuest(id,name){
 if(!confirm(`حذف ${name} من قائمة الضيوف؟\nسيصبح رابط دعوته غير صالح.`))return;
 const res=await fetch('/api/guests',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({eventId,ownerToken:token,guestId:id})}); const data=await res.json();
 if(!res.ok)return toast(data.error||'تعذر حذف الضيف'); await load(); toast('تم حذف الضيف');
}
function normalizePhone(phone){let p=String(phone||'').replace(/[^0-9]/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.startsWith('0')&&p.length===10)p='966'+p.slice(1);if(p.length===9&&p.startsWith('5'))p='966'+p;return p;}
function formatEventDate(event){if(!event?.event_date)return '';const raw=String(event.event_date).slice(0,10);const d=new Date(`${raw}T12:00:00+03:00`);if(Number.isNaN(d.getTime()))return String(event.event_date);const day=new Intl.DateTimeFormat('ar-SA-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Riyadh'}).format(d);const m=String(event.event_time||'').match(/^(\d{1,2}):(\d{2})/);if(!m)return day;const td=new Date(`${raw}T${m[1].padStart(2,'0')}:${m[2]}:00+03:00`);const clock=new Intl.DateTimeFormat('ar-SA-u-nu-latn',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Riyadh'}).format(td);return `${day} — ${clock}`}
function makeMessage(name,code,event,reminder=false){const url=`${location.origin}/i/${code}`,date=formatEventDate(event);return `${reminder?'تذكير لطيف ✨\n\n':''}مرحبًا ${name} ✨\nيشرفنا دعوتكم إلى ${event.title}.\n${date?`📅 ${date}\n`:''}${event.location?`📍 ${event.location}\n`:''}\n${reminder?'يسعدنا تأكيد حضوركم من الرابط:\n':'لمشاهدة الدعوة وتأكيد الحضور:\n'}${url}`}
async function sendWhatsApp(phone,name,code,event,reminder=false,guestId=null){const p=normalizePhone(phone);if(!p){toast('أضف رقم جوال الضيف أولًا');return;}if(guestId){try{const res=await fetch('/api/whatsapp/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId,ownerToken:token,guestId,reminder})});const data=await res.json().catch(()=>({}));if(res.ok){toast(reminder?'تم إرسال التذكير عبر WhatsApp ✓':'تم إرسال الدعوة عبر WhatsApp ✓');setTimeout(load,900);return;}if(data.code==='D360_TEMPLATE_REQUIRED')toast('ربط واتساب جاهز تقنيًا؛ بقي اعتماد قالب الرسالة للإنتاج');else if(data.code!=='D360_NOT_CONFIGURED')toast(data.error||'تعذر الإرسال الآلي');}catch{} }window.open(`https://wa.me/${p}?text=${encodeURIComponent(makeMessage(name,code,event,reminder))}`,'_blank','noopener');}
function openReminderQueue(event,guests){
 const pending=guests.filter(g=>(!g.rsvp_status||g.rsvp_status==='pending'||g.rsvp_status==='maybe')&&normalizePhone(g.phone));
 if(!pending.length){toast('لا يوجد ضيوف بحاجة لتذكير ولديهم أرقام جوال');return;}
 showReminderPanel(event,pending);
}
function showReminderPanel(event,guests){
 const old=document.getElementById('reminderModal'); old?.remove();
 const modal=document.createElement('div'); modal.id='reminderModal'; modal.className='dash-modal';
 modal.innerHTML=`<div class="dash-modal-card"><div class="modal-head"><div><span class="eyebrow dark">قائمة التذكير</span><h3>${guests.length} ضيف</h3><p>سيحاول نورتونا الإرسال عبر WhatsApp Business، وإن لم يكن الربط مكتملًا سيفتح واتساب لإرسال الرسالة يدويًا.</p></div><button class="modal-close" aria-label="إغلاق">×</button></div><div class="reminder-list">${guests.map(g=>`<div><span><strong>${esc(g.name)}</strong><small>${esc(g.phone||'')}</small></span><button class="wa-link reminder-one" data-code="${esc(g.code)}" data-phone="${esc(g.phone||'')}" data-name="${esc(g.name)}" data-id="${esc(g.id)}">إرسال التذكير</button></div>`).join('')}</div></div>`;
 document.body.appendChild(modal); modal.querySelector('.modal-close').onclick=()=>modal.remove(); modal.onclick=e=>{if(e.target===modal)modal.remove()}; modal.querySelectorAll('.reminder-one').forEach(b=>b.onclick=()=>sendWhatsApp(b.dataset.phone,b.dataset.name,b.dataset.code,event,true,b.dataset.id));
}
function csvCell(v){return `"${String(v??'').replaceAll('"','""')}"`}
function exportCSV(event,guests){
 const isActivity=event.occasion==='تجمع ونشاط'; const headers=isActivity?['الاسم','الجوال','حالة الرد','شاهد الدعوة','عدد المرافقين','أسماء المرافقين','إجمالي القطّة','حالة الدفع','ملاحظة','رابط الدعوة']:['الاسم','الجوال','حالة الرد','شاهد الدعوة','عدد المرافقين','عدد الأطفال','ملاحظة','رابط الدعوة'];
 const rows=guests.map(g=>isActivity?[g.name,g.phone||'',g.attendance_state==='waitlist'?'قائمة انتظار':statusLabel(g),g.viewed_at?'نعم':'لا',g.companion_count||0,parseCompanionNames(g.companion_names).join('، '),g.share_total||0,paymentLabel(g),g.note||'',`${location.origin}/i/${g.code}`]:[g.name,g.phone||'',statusLabel(g),g.viewed_at?'نعم':'لا',g.companion_count||0,g.children_count||0,g.note||'',`${location.origin}/i/${g.code}`]);
 const csv='\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`noortoona-${String(event.title||'guests').replace(/[^\p{L}\p{N}-]+/gu,'-')}.csv`;a.click();URL.revokeObjectURL(a.href);toast('تم تصدير قائمة الضيوف');
}
async function parseGuestFile(file){
 try{
  const rows=await readSpreadsheet(file); const parsed=rowsToGuests(rows);
  const existing=new Set((dashboardData?.guests||[]).map(g=>`${String(g.name||'').trim().toLowerCase()}|${String(g.phone||'').replace(/\D/g,'')}`));
  const guests=parsed.filter(g=>!existing.has(`${g.name.trim().toLowerCase()}|${String(g.phone||'').replace(/\D/g,'')}`));
  if(!parsed.length)return toast('لم نجد أسماء ضيوف صالحة في الملف');
  if(!guests.length)return toast('كل الأسماء الموجودة في الملف مضافة مسبقًا');
  importPreview=guests.slice(0,1000); showImportPreview(file.name,importPreview);
 }catch(err){console.error(err);toast('تعذر قراءة الملف. جرّب CSV أو Excel بصيغة xlsx.');}
}
async function readSpreadsheet(file){
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='csv'){
  const text=await file.text(); return parseCSV(text);
 }
 if(!window.XLSX)throw new Error('XLSX unavailable');
 const buffer=await file.arrayBuffer(); const wb=XLSX.read(buffer,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
}
function parseCSV(text){
 const rows=[]; let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue}
  if(ch==='"'){quoted=!quoted;continue}
  if(ch===','&&!quoted){row.push(cell);cell='';continue}
  if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);row=[];cell='';continue}
  cell+=ch;
 }
 row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);return rows;
}
function normalizeHeader(v){return String(v||'').trim().toLowerCase().replace(/[\s_\-]/g,'')}
function rowsToGuests(rows){
 if(!Array.isArray(rows)||!rows.length)return [];
 const first=rows[0]||[]; const heads=first.map(normalizeHeader);
 const nameKeys=['الاسم','اسمالضيف','name','guest','guestname','الضيف']; const phoneKeys=['الجوال','رقمالجوال','الهاتف','رقمالهاتف','phone','mobile','mobilenumber'];
 let nameIdx=heads.findIndex(h=>nameKeys.includes(h)), phoneIdx=heads.findIndex(h=>phoneKeys.includes(h));
 let start=1;
 if(nameIdx<0){nameIdx=0;phoneIdx=heads.length>1?1:-1;start=0}
 const seen=new Set(); const out=[];
 for(const r of rows.slice(start)){
  const name=String(r?.[nameIdx]??'').trim(); const phone=phoneIdx>=0?String(r?.[phoneIdx]??'').trim():'';
  if(!name||name.length<2)continue;
  const key=`${name.toLowerCase()}|${phone.replace(/\D/g,'')}`; if(seen.has(key))continue; seen.add(key); out.push({name,phone});
 }
 return out;
}
function showImportPreview(filename,guests){
 const old=document.getElementById('importModal');old?.remove();
 const sample=guests.slice(0,8);
 const modal=document.createElement('div');modal.id='importModal';modal.className='dash-modal';modal.innerHTML=`<div class="dash-modal-card import-card"><div class="modal-head"><div><span class="eyebrow dark">استيراد الضيوف</span><h3>${esc(filename)}</h3><p>وجدنا <strong>${guests.length}</strong> ضيفًا. راجع العينة ثم اضغط الاستيراد.</p></div><button class="modal-close" aria-label="إغلاق">×</button></div><div class="import-summary"><span>الاسم</span><span>الجوال</span>${sample.map(g=>`<strong>${esc(g.name)}</strong><small>${esc(g.phone||'—')}</small>`).join('')}</div>${guests.length>sample.length?`<p class="import-more">+ ${guests.length-sample.length} ضيف إضافي</p>`:''}<div class="modal-actions"><button class="outline-btn dark-outline cancel-import">إلغاء</button><button class="gold-btn confirm-import">استيراد ${guests.length} ضيف</button></div><div class="import-progress hidden"><div><span></span></div><small>جاري إنشاء روابط الدعوات…</small></div></div>`;
 document.body.appendChild(modal); modal.querySelector('.modal-close').onclick=()=>modal.remove(); modal.querySelector('.cancel-import').onclick=()=>modal.remove(); modal.onclick=e=>{if(e.target===modal)modal.remove()}; modal.querySelector('.confirm-import').onclick=()=>bulkImportGuests(modal,guests);
}
async function bulkImportGuests(modal,guests){
 const btn=modal.querySelector('.confirm-import'),progress=modal.querySelector('.import-progress'); btn.disabled=true;btn.textContent='جاري الاستيراد…';progress.classList.remove('hidden');
 try{
  const res=await fetch('/api/guests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId,ownerToken:token,guests})}); const data=await res.json();
  if(!res.ok)throw new Error(data.error||'تعذر الاستيراد'); progress.querySelector('span').style.width='100%'; await load(); modal.remove(); toast(`تم استيراد ${data.count||guests.length} ضيف وإنشاء الروابط ✨`);
 }catch(err){btn.disabled=false;btn.textContent=`إعادة المحاولة`;toast(err.message)}
}
async function copyInvite(code){const url=`${location.origin}/i/${code}`;try{await navigator.clipboard.writeText(url);toast('تم نسخ رابط الدعوة');}catch{prompt('انسخ رابط الدعوة:',url)}}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3200)}
load();
