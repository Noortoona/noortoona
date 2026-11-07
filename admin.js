const root=document.getElementById("adminRoot");
let s=null,eventQuery="",eventPage=1,catalogRevision=0;
const esc=x=>String(x??"").replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[m]));
const n=x=>Number(x||0).toLocaleString("ar-SA");
const money=x=>(Number(x||0)/100).toLocaleString("ar-SA",{maximumFractionDigits:2})+" ر.س";
document.getElementById("logoutBtn").onclick=async()=>{try{const session=JSON.parse(localStorage.getItem("halaSession")||"null");if(session?.token)await fetch("/api/auth/logout",{method:"POST",headers:{authorization:`Bearer ${session.token}`}})}catch{}finally{localStorage.removeItem("halaSession");localStorage.removeItem("noortoonaOwner");location.href="/"}};

async function boot(){
  const authScript=document.createElement("script");
  authScript.src="/account.js";
  authScript.onload=async()=>{
    try{
      const session=await window.HALA_AUTH.ensureLogin("admin");
      if(!session){
        root.innerHTML='<div class="portal-empty"><h2>دخول الأدمن</h2><p>سجّل دخولك برقم جوال الأدمن ورمز التحقق.</p><button class="gold-btn" id="adminLoginAgain">تسجيل الدخول</button></div>';
        document.getElementById("adminLoginAgain").onclick=bootLogin;
        return;
      }
      if(!["admin","customer_service"].includes(session.user?.role)){
        root.innerHTML='<div class="portal-empty"><h2>هذا الحساب ليس أدمن</h2><p>استخدم رقم جوال مسجّلًا بصلاحية الأدمن.</p><button class="gold-btn" id="switchAdminPhone">دخول برقم آخر</button></div>';
        document.getElementById("switchAdminPhone").onclick=()=>{localStorage.removeItem("halaSession");location.reload()};
        return;
      }
      s=session;
      load();
    }catch(error){
      root.innerHTML='<div class="portal-empty"><h2>تعذر فتح تسجيل الدخول</h2><p>أعد تحميل الصفحة وحاول مرة أخرى.</p></div>';
    }
  };
  authScript.onerror=()=>{root.innerHTML='<div class="portal-empty"><h2>تعذر تحميل تسجيل الدخول</h2><p>أعد تحميل الصفحة وحاول مرة أخرى.</p></div>'};
  document.body.appendChild(authScript);
}
async function bootLogin(){
  const session=await window.HALA_AUTH.ensureLogin("admin");
  if(["admin","customer_service"].includes(session?.user?.role)){s=session;load()}
  else if(session){localStorage.removeItem("halaSession");location.reload()}
}
boot();

async function api(url,opt={}){
  const r=await fetch(url,{...opt,headers:{"content-type":"application/json",authorization:`Bearer ${s.token}`,...(opt.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(d.error||"تعذر تنفيذ الطلب"),{status:r.status});
  return d;
}
function card(label,value,sub=""){return `<article class="metric-card"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`}
async function load(){
  if(s?.user?.role==="customer_service"){root.className="";root.innerHTML="";mountBookingWorkspace();return;}
  try{
    const [overview,usersData,supData,settings,partners,eventsData,catalog]=await Promise.all([api("/api/admin/overview"),api("/api/admin/users"),api("/api/admin/supervisors"),api("/api/admin/settings"),api("/api/admin/partners"),api(`/api/admin/events?page=${eventPage}&q=${encodeURIComponent(eventQuery)}`),api("/api/admin/catalog")]);
    render(overview,usersData.users||[],supData,settings,partners,eventsData,catalog);
  }catch(e){
    root.innerHTML=`<div class="portal-empty"><h2>تعذر فتح لوحة الإدارة</h2><p>${esc(e.message)}</p></div>`;
  }
}
function render(d,users,supData,settings,partners,eventsData,catalog){
  const x=d.stats,w=x.whatsapp||{},sr=x.supervisorRequests||{};
  const supervisors=supData.supervisors||[],requests=supData.requests||[];
  root.className="";
  root.innerHTML=`
    <section class="metrics-grid">
      ${card("زيارات اليوم",n(x.visitsToday),"إجمالي "+n(x.visits))}
      ${card("جلسات 7 أيام",n(x.uniqueVisitors7d),"معرّفات جلسات مسجّلة")}
      ${card("العملاء",n(x.customers),"حسابات موثقة")}
      ${card("المناسبات",n(x.events),n(x.eventsToday)+" اليوم")}
      ${card("الضيوف",n(x.guests),n(x.accepted)+" مؤكد")}
      ${card("RSVP",n(x.accepted)+" مؤكد",n(x.declined)+" اعتذر • "+n(x.pendingRsvp)+" بانتظار الرد")}
      ${card("المشرفون",n(x.supervisors),"حسابات مشرف")}
      ${card("مشاهدات الدعوات",n(x.inviteViews),"ضيوف فتحوا الدعوة")}
      ${card("تم الدخول",n(x.checkedIn),"QR")}
      ${card("إيرادات مدفوعة",money(x.revenueHalalas),n(x.paidOrders)+" عملية")}
      ${card("طلبات مشرف",n(sr.requested||0),n(sr.assigned||0)+" معيّن")}
    </section>

    <section class="portal-grid">
      <article class="portal-panel">
        <h2>واتساب</h2>
        <div class="mini-metrics">
          ${card("الكل",n(w.total))}
          ${card("أُرسلت",n(w.sent))}
          ${card("وصلت",n(w.delivered))}
          ${card("قُرئت",n(w.read))}
          ${card("فشلت",n(w.failed))}
        </div>
      </article>
      <article class="portal-panel">
        <h2>أحدث المناسبات</h2>
        <div class="portal-list">${d.recentEvents.map(e=>`<div><b>${esc(e.title)}</b><span>${esc(e.occasion)} • ${esc(e.city||"")}</span><small>${new Date(e.created_at).toLocaleString("ar-SA")}</small></div>`).join("")||"<p>لا توجد بيانات بعد</p>"}</div>
      </article>
    </section>

    <section class="portal-panel">
      <div class="panel-head"><div><span class="eyebrow dark">الإعدادات</span><h2>تسعير مشرف المناسبة</h2><p>يتغير هذا السعر مباشرة في خطوة الدفع وطلب المشرف.</p></div>
      <form id="supervisorPriceForm" class="inline-admin-form"><input name="price" type="number" min="0" step="1" value="${Number(settings.supervisorAddonSar||0)}" required><button class="gold-btn" type="submit">حفظ السعر</button></form></div>
    </section>

    ${catalogPanel(catalog)}

    <section class="portal-panel admin-supervisor-panel">
      <div class="panel-head"><div><span class="eyebrow dark">المشرفون</span><h2>طلبات مشرف المناسبة</h2></div>
      <form id="createSupervisorForm" class="inline-admin-form"><input name="name" placeholder="اسم المشرف" required><input name="phone" inputmode="tel" placeholder="05XXXXXXXX" required><button class="gold-btn" type="submit">إضافة مشرف</button></form></div>
      <div class="supervisor-admin-list">
        ${requests.length?requests.map(r=>`<div class="supervisor-request"><div><b>${esc(r.title)}</b><span>${esc(r.customer_name||"")} • ${esc(r.customer_phone||"")}</span><small>${esc(r.city||"")} • ${esc(r.event_date||"")}</small><small><b>النوع المطلوب:</b> ${r.supervisor_preference==="female"?"مشرفة":r.supervisor_preference==="male"?"مشرف":"لم يحدد"}</small></div><div><strong>${money(r.amount)}</strong><span class="request-status">${esc(r.status)}</span></div><div>${r.status==="requested"?`<select data-request-select="${r.id}"><option value="">اختر مشرفًا</option>${supervisors.map(su=>`<option value="${su.id}">${esc(su.name)} • ${esc(su.phone||"")}</option>`).join("")}</select><button class="gold-btn small" data-assign-request="${r.id}">تعيين</button>`:`<b>${esc(r.supervisor_name||"بانتظار التعيين")}</b><small>${esc(r.supervisor_phone||"")}</small>`}</div></div>`).join(""):"<p>لا توجد طلبات مشرف حاليًا.</p>"}
      </div>
    </section>

    <section class="portal-panel">
      <div class="panel-head"><div><span class="eyebrow dark">شركاء العمل</span><h2>القاعات والمشاهير</h2><p>عمولة 10% على أول شراء مدفوع؛ كود المشهور يمنح خصمًا 10% على الباقة.</p></div>
        <form id="createPartnerForm" class="inline-admin-form"><input name="name" placeholder="اسم الشريك" required><input name="phone" inputmode="tel" placeholder="05XXXXXXXX" required><input name="code" placeholder="كود إنجليزي فريد" minlength="4" maxlength="24" required><select name="kind"><option value="venue">قاعة</option><option value="influencer">مشهور</option></select><button class="gold-btn" type="submit">حفظ الشريك</button></form></div>
      <div class="portal-list">${(partners.partners||[]).map(p=>`<div><b>${esc(p.name)} • ${esc(p.code)}</b><span>${p.kind==='venue'?'قاعة':'مشهور'} • ${n(p.customers)} عميل • مستحق ${money(p.commission_due)} • مدفوع ${money(p.commission_paid)}</span><small>${esc(p.phone)} • ${esc(p.status)}</small><button class="outline-btn dark-outline" data-partner="${esc(p.user_id)}" data-status="${p.status==='active'?'paused':'active'}">${p.status==='active'?'إيقاف الكود':'تفعيل الكود'}</button></div>`).join('')||'<p>لم تُضف شركاء بعد</p>'}</div>
      <h3>آخر العمولات</h3><div class="portal-list">${(partners.commissions||[]).slice(0,20).map(c=>`<div><b>${esc(c.partner_name)} • ${money(c.amount)}</b><span>${esc(c.customer_name)} • ${esc(c.status)}</span><small>${new Date(c.created_at).toLocaleDateString('ar-SA')}</small>${c.status==='pending'||c.status==='approved'?`<button class="outline-btn dark-outline" data-commission="${esc(c.id)}" data-next="${c.status==='pending'?'approved':'paid'}">${c.status==='pending'?'مراجعة واعتماد':'تسجيل تحويل العمولة'}</button><button class="outline-btn dark-outline" data-commission="${esc(c.id)}" data-next="void">إلغاء العمولة</button>`:''}</div>`).join('')||'<p>لا توجد عمولات بعد</p>'}</div>
    </section>

    <section class="portal-grid admin-lower-grid">
      <article class="portal-panel">
        <h2>أحدث عمليات الدفع</h2>
        <div class="portal-list">${d.recentPayments.map(p=>`<div><b>${esc(p.customer_name||"عميل")}</b><span>${money(Number(p.amount||0))} • ${esc(p.status)}</span><small>${new Date(p.created_at).toLocaleString("ar-SA")}</small></div>`).join("")||"<p>لا توجد عمليات دفع بعد</p>"}</div>
      </article>
      <article class="portal-panel">
        <h2>الحسابات</h2>
        <div class="portal-list users-list">${users.map(u=>`<div><b>${esc(u.name||"بدون اسم")}</b><span>${esc(u.role)} • ${esc(u.phone||u.email||"")}</span><small>${esc(u.status||"")}</small>${u.role!=="admin"?`<button class="outline-btn dark-outline" data-user-status="${esc(u.id)}" data-next-status="${u.status==="active"?"suspended":"active"}">${u.status==="active"?"إيقاف الحساب":"تفعيل الحساب"}</button>`:""}</div>`).join("")||"<p>لا توجد حسابات بعد</p>"}</div>
      </article>
    </section>

    <section class="portal-panel">
      <h2>إدارة المناسبات</h2>
      <form id="eventSearch" class="inline-admin-form"><input name="q" value="${esc(eventQuery)}" placeholder="ابحث باسم المناسبة أو المدينة" aria-label="البحث في المناسبات"><button class="gold-btn" type="submit">بحث</button></form>
      <div class="portal-list">${(eventsData.events||[]).map(e=>`<div><b>${esc(e.title)}</b><span>${esc(e.occasion)} • ${esc(e.city||"")} • ${esc(e.owner_name||"")}</span><small>${n(e.guest_count)} ضيف • ${n(e.accepted)} مؤكد • ${n(e.checked_in)} حضر</small><a class="gold-btn" href="/dashboard?event=${encodeURIComponent(e.id)}">إدارة الدعوات والحضور</a></div>`).join("")||"<p>لا توجد مناسبات مطابقة</p>"}</div>
      <div class="event-actions"><button class="outline-btn dark-outline" id="previousEvents" ${eventPage<=1?"disabled":""}>السابق</button><span>صفحة ${n(eventPage)}</span><button class="outline-btn dark-outline" id="nextEvents" ${eventsData.hasMore?"":"disabled"}>التالي</button></div>
    </section>

    <section class="portal-panel">
      <h2>سجل العمليات</h2>
      <div class="ops-table">${d.recentOps.map(o=>`<div><b>${esc(o.action)}</b><span>${esc(o.actor_name||"النظام")}</span><span>${esc(o.entity_type||"")} ${esc(o.entity_id||"")}</span><small>${new Date(o.created_at).toLocaleString("ar-SA")}</small></div>`).join("")||"<p>لا توجد عمليات بعد</p>"}</div>
    </section>`;

  mountBookingWorkspace();
  bindCatalogForms();
  document.getElementById("eventSearch")?.addEventListener("submit",e=>{e.preventDefault();eventQuery=String(new FormData(e.currentTarget).get("q")||"");eventPage=1;load()});
  document.getElementById("previousEvents").onclick=()=>{eventPage=Math.max(1,eventPage-1);load()};
  document.getElementById("nextEvents").onclick=()=>{eventPage++;load()};
  document.querySelectorAll('[data-user-status]').forEach(b=>b.onclick=async()=>{const status=b.dataset.nextStatus;if(!confirm(status==='suspended'?'إيقاف الحساب وإنهاء جلساته الحالية؟':'إعادة تفعيل الحساب؟'))return;b.disabled=true;try{await api('/api/admin/users',{method:'PATCH',body:JSON.stringify({userId:b.dataset.userStatus,status})});await load()}catch(e){alert(e.message);b.disabled=false}});
  document.getElementById("supervisorPriceForm")?.addEventListener("submit",saveSupervisorPrice);
  document.getElementById("createSupervisorForm")?.addEventListener("submit",createSupervisor);
  document.getElementById("createPartnerForm")?.addEventListener("submit",createPartner);
  document.querySelectorAll('[data-partner]').forEach(b=>b.addEventListener('click',()=>togglePartner(b.dataset.partner,b.dataset.status)));
  document.querySelectorAll('[data-commission]').forEach(b=>b.addEventListener('click',()=>updateCommission(b.dataset.commission,b.dataset.next)));
  document.querySelectorAll("[data-assign-request]").forEach(b=>b.addEventListener("click",()=>assignSupervisor(b.dataset.assignRequest)));
}
async function createPartner(e){
  e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button');button.disabled=true;
  try{await api('/api/admin/partners',{method:'POST',body:JSON.stringify(Object.fromEntries(fd))});await load()}
  catch(err){alert(err.message);button.disabled=false}
}
async function togglePartner(userId,status){
  try{await api('/api/admin/partners',{method:'PATCH',body:JSON.stringify({userId,status})});await load()}
  catch(err){alert(err.message)}
}
async function updateCommission(id,status){
  if(status==='paid'&&!confirm('هل تم تحويل العمولة فعليًا خارج هلا؟'))return;
  if(status==='void'&&!confirm('هل تريد إلغاء استحقاق هذه العمولة؟'))return;
  try{await api('/api/admin/partner-commissions',{method:'PATCH',body:JSON.stringify({id,status})});await load()}
  catch(err){alert(err.message)}
}
async function createSupervisor(e){
  e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector("button");button.disabled=true;
  try{await api("/api/admin/users",{method:"POST",body:JSON.stringify({name:fd.get("name"),phone:fd.get("phone"),role:"supervisor"})});await load()}
  catch(err){alert(err.message);button.disabled=false}
}
async function assignSupervisor(requestId){
  const select=document.querySelector(`[data-request-select="${requestId}"]`),supervisorId=select?.value;
  if(!supervisorId)return alert("اختر المشرف أولًا");
  try{await api("/api/admin/supervisors",{method:"POST",body:JSON.stringify({requestId,supervisorId})});await load()}
  catch(err){alert(err.message)}
}

async function saveSupervisorPrice(e){
  e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector("button");button.disabled=true;
  try{await api("/api/admin/settings",{method:"POST",body:JSON.stringify({supervisorAddonSar:Number(fd.get("price"))})});await load()}
  catch(err){alert(err.message);button.disabled=false}
}

function catalogPanel(catalog){
  catalogRevision=Number(catalog.revision||0);
  const labels={wedding:'الزواج',milkah:'الملكة',engagement:'الخطوبة',graduation:'التخرج',newborn:'المواليد',birthday:'أعياد الميلاد',meeting:'الاجتماعات',conference:'المؤتمرات',opening:'الافتتاح',honoring:'التكريم',formal:'الرسمية',national:'الوطنية',condolence:'العزاء',custom:'المخصصة',padel:'البادل',football:'كرة القدم',camp:'الكشتات',chalet:'الاستراحة',trip:'الرحلات',dinner:'العشاء',activityCustom:'أنشطة مخصصة'};
  const hidden=new Set(catalog.hiddenTemplateKeys||[]),groups=(catalog.templateKeys||[]).reduce((groups,item)=>{(groups[item.group]||=[]).push(item);return groups},{});
  return `<section class="portal-panel catalog-admin"><h2>الباقات والقوالب والخدمات</h2><p>تُستخدم هذه الإعدادات في منشئ الدعوة والتسعير. الطلبات المدفوعة سابقًا تحتفظ بحدودها الأصلية.</p>
  <div class="catalog-package-grid">${catalog.packages.map(p=>`<form class="catalog-package-form" data-package-code="${esc(p.code)}"><h3>${esc(p.name)}</h3><label>السعر بالريال<input name="amountSar" type="number" min="1" max="100000" step="0.01" value="${Number(p.amount)/100}" required></label><label>حد المدعوين<input name="guestLimit" type="number" min="1" max="5000" step="1" value="${Number(p.guestLimit)}" required></label><button class="gold-btn" type="submit">حفظ الباقة</button></form>`).join('')}</div>
  <form id="catalogTemplatesForm"><h3>القوالب المتاحة للإنشاء</h3><p>إخفاء القالب يمنع اختياره في دعوة جديدة، ويُبقي الدعوات السابقة كما هي. يجب إبقاء قالب واحد على الأقل لكل نوع.</p><div class="catalog-template-groups">${Object.entries(groups).map(([group,items])=>`<details><summary>${esc(labels[group]||group)}</summary>${items.map(item=>`<label class="catalog-toggle"><input type="checkbox" data-template-key="${esc(item.key)}" ${hidden.has(item.key)?'':'checked'}><span>${esc(item.name)}</span></label>`).join('')}</details>`).join('')}</div><button class="gold-btn" type="submit">حفظ إتاحة القوالب</button></form>
  <form id="catalogServicesForm"><h3>الخدمات الإضافية المعروضة</h3><div id="catalogServiceRows">${(catalog.services||[]).map(serviceRow).join('')}</div><div class="event-actions"><button class="outline-btn dark-outline" id="addCatalogService" type="button">إضافة خدمة</button><button class="gold-btn" type="submit">حفظ الخدمات</button></div></form><p id="catalogResult" role="status" aria-live="polite"></p></section>`;
}
function serviceRow(service){return `<fieldset class="catalog-service-row" data-service-id="${esc(service.id)}"><label>اسم الخدمة<input data-service-name maxlength="80" value="${esc(service.name)}" required></label><label>الوصف<textarea data-service-description rows="2" maxlength="400" required>${esc(service.description)}</textarea></label><label class="catalog-toggle"><input data-service-enabled type="checkbox" ${service.enabled!==false?'checked':''}>عرض الخدمة للعملاء</label><button class="outline-btn dark-outline" data-remove-service type="button">إزالة من القائمة</button></fieldset>`}
async function saveCatalog(body,form){
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{await api('/api/admin/catalog',{method:'PATCH',body:JSON.stringify({...body,expectedRevision:catalogRevision})});await load();catalogNotice('تم حفظ إعدادات الكتالوج.')}
  catch(error){if(error.status===409){await load();catalogNotice('تغيرت الإعدادات في جلسة أخرى. راجع القيم الجديدة ثم احفظ.')}else{catalogNotice(error.message);button.disabled=false}}
}
function bindCatalogForms(){
  document.querySelectorAll('.catalog-package-form').forEach(form=>form.onsubmit=e=>{e.preventDefault();const fields=new FormData(form);saveCatalog({packages:[{code:form.dataset.packageCode,amount:Math.round(Number(fields.get('amountSar'))*100),guestLimit:Number(fields.get('guestLimit'))}]},form)});
  document.getElementById('catalogTemplatesForm').onsubmit=e=>{e.preventDefault();const hiddenTemplateKeys=[...e.currentTarget.querySelectorAll('[data-template-key]')].filter(input=>!input.checked).map(input=>input.dataset.templateKey);saveCatalog({hiddenTemplateKeys},e.currentTarget)};
  document.getElementById('catalogServicesForm').onsubmit=e=>{e.preventDefault();const services=[...e.currentTarget.querySelectorAll('[data-service-id]')].map(row=>({id:row.dataset.serviceId,name:row.querySelector('[data-service-name]').value.trim(),description:row.querySelector('[data-service-description]').value.trim(),enabled:row.querySelector('[data-service-enabled]').checked}));saveCatalog({services},e.currentTarget)};
  const rows=document.getElementById('catalogServiceRows');rows.onclick=e=>{if(e.target.matches('[data-remove-service]'))e.target.closest('[data-service-id]').remove()};
  document.getElementById('addCatalogService').onclick=()=>rows.insertAdjacentHTML('beforeend',serviceRow({id:'s_'+crypto.randomUUID(),name:'',description:'',enabled:true}));
}

function catalogNotice(message){const notice=document.getElementById("catalogResult");if(notice)notice.textContent=message;else alert(message)}


let bookingFilters={q:new URLSearchParams(location.search).get('booking')||'',status:'',paymentStatus:'',page:1};
let bookingRows=[],leadRows=[],bookingStaff=[];
const H=()=>window.HALA_BOOKING;
const when=value=>value?new Date(value).toLocaleString('ar-SA'):'—';
function workspaceError(id,error){document.getElementById(id).innerHTML=`<p class="auth-error" role="alert">${esc(error.message)}</p>`;}
function mountBookingWorkspace(){
  let workspace=document.getElementById('bookingWorkspace');
  if(!workspace){workspace=document.createElement('div');workspace.id='bookingWorkspace';root.prepend(workspace);}
  workspace.innerHTML=`<nav class="booking-admin-nav"><a href="#adminBookings">إدارة الحجوزات</a><a href="#adminLeads">عملاء ما قبل الإطلاق</a><a href="#adminInsights">الزيارات والعملاء والاهتمامات</a></nav><section id="adminBookings" class="portal-panel"><div class="panel-head"><div><span class="eyebrow">Bookings Management</span><h2>إدارة الحجوزات</h2><p>طلبات فعلية محفوظة في قاعدة البيانات. حالة الحجز مستقلة عن الدفع.</p></div><button class="outline-btn dark-outline" id="refreshBookings">تحديث</button></div><form id="bookingFilters" class="inline-admin-form"><input name="q" aria-label="البحث في الحجوزات" placeholder="رقم الحجز أو اسم العميل أو الجوال" value="${esc(bookingFilters.q)}"><select name="status" aria-label="حالة الحجز"><option value="">كل حالات الحجز</option value="pre_booking_received">حجز مبدئي</option value="confirmed">مؤكد</option value="cancelled">ملغي</option></select><select name="paymentStatus" aria-label="حالة الدفع"><option value="">كل حالات الدفع</option><option value="pending_payment">بانتظار الدفع</option><option value="paid">مدفوع</option></select><button class="gold-btn" type="submit">بحث وتصفية</button><button class="outline-btn dark-outline" type="button" id="exportBookings">تصدير CSV</button></form><div id="bookingNotifications" aria-live="polite"></div><div id="bookingTable" class="portal-loading">جاري تحميل الحجوزات…</div><div class="event-actions"><button class="outline-btn dark-outline" id="bookingPrevious">السابق</button><span id="bookingPage"></span><button class="outline-btn dark-outline" id="bookingNext">التالي</button></div></section><section id="adminLeads" class="portal-panel"><span class="eyebrow">Pre-Launch CRM</span><h2>عملاء ما قبل الإطلاق</h2><p>طلبات التواصل والاهتمامات المسجلة؛ لا تُعتبر مشاهدات الصفحات عملاء معروفين.</p><button class="outline-btn dark-outline" id="refreshLeads">تحديث العملاء</button><div id="leadTable" class="portal-loading">جاري تحميل العملاء…</div></section><section id="adminInsights" class="portal-panel"><span class="eyebrow">Analytics &amp; Leads</span><h2>الزيارات والعملاء والاهتمامات</h2><p>أرقام فعلية قابلة للمراجعة. غياب البيانات يظهر صفرًا؛ الجلسات ومعرّفات الزوار ليست أشخاصًا مؤكدين.</p><button class="outline-btn dark-outline" id="refreshInsights">تحديث المؤشرات</button><div id="insightTable" class="portal-loading">جاري تحميل المؤشرات…</div></section>${s.user.role==='admin'?'<section class="portal-panel"><h2>إعدادات التواصل والحجوزات</h2><form id="bookingSettingsForm" class="lead-form"><label>رقم خدمة العملاء بالصيغة الدولية<input name="supportPhone" inputmode="tel" required></label><label>رقم استقبال إشعارات الحجوزات<input name="notificationPhone" inputmode="tel" required></label><button class="gold-btn" type="submit">حفظ إعدادات التواصل</button><p id="bookingSettingsNotice" role="status"></p></form><p>الإرسال الآلي يحتاج مزود واتساب وقالبًا معتمدًا. رابط المحادثة لا يرسل إشعارًا تلقائيًا.</p></section>':''}`;
  document.getElementById('bookingFilters').elements.status.value=bookingFilters.status;
  document.getElementById('bookingFilters').elements.paymentStatus.value=bookingFilters.paymentStatus;
  document.getElementById('bookingFilters').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);bookingFilters={q:String(f.get('q')||''),status:String(f.get('status')||''),paymentStatus:String(f.get('paymentStatus')||''),page:1};loadBookings();};
  document.getElementById('refreshBookings').onclick=loadBookings;
  document.getElementById('refreshLeads').onclick=loadLeads;
  document.getElementById('refreshInsights').onclick=loadInsights;
  document.getElementById('bookingPrevious').onclick=()=>{bookingFilters.page=Math.max(1,bookingFilters.page-1);loadBookings();};
  document.getElementById('bookingNext').onclick=()=>{bookingFilters.page++;loadBookings();};
  document.getElementById('exportBookings').onclick=exportBookings;
  if(s.user.role==='admin'){
 loadBookingSettings();
 const staffPanel=document.createElement('section');staffPanel.className='portal-panel';staffPanel.innerHTML='<h2>إضافة موظفة خدمة العملاء</h2><p>أدخل بيانات الموظفة الفعلية فقط. الدخول برقمها المسجل، دون صلاحية تغيير الأسعار أو اعتماد الدفع.</p><form id="staffCreateForm" class="inline-admin-form"><input name="name" required minlength="2" maxlength="120" aria-label="اسم الموظفة" placeholder="اسم الموظفة"><input name="phone" required type="tel" aria-label="جوال الموظفة" placeholder="جوال الموظفة"><button class="gold-btn" type="submit">إنشاء حساب خدمة العملاء</button><p role="status"></p></form>';workspace.append(staffPanel);
 staffPanel.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),notice=form.querySelector('[role="status"]'),fields=new FormData(form);button.disabled=true;try{await api('/api/admin/users',{method:'POST',body:JSON.stringify({name:fields.get('name'),phone:fields.get('phone'),role:'customer_service'})});notice.textContent='تم حفظ الحساب بصلاحية خدمة العملاء.';form.reset();}catch(error){notice.textContent=error.message;}finally{button.disabled=false;}};
}
  loadBookings();loadLeads();loadInsights();
}
function bookingQuery(){return new URLSearchParams(Object.entries(bookingFilters).filter(([,value])=>value!==''));}
async function loadBookings(){
  try{
    const d=await api('/api/admin/bookings?'+bookingQuery());bookingRows=d.bookings||[];bookingStaff=d.staff||[];
    document.getElementById('bookingNotifications').innerHTML=(d.notifications||[]).slice(0,20).map(note=>{
      const status = note.status || note.delivery_status || note.whatsapp_status;
      let label;
      if (note.kind === 'internal') {
        label = note.read_at ? 'تمت متابعة الإشعار' : 'إشعار داخلي جديد';
      } else if (status === 'queued' && note.message_id) {
        label = 'مقبول لدى مزوّد واتساب';
      } else {
        label = H().label(status);
      }
      return `<div class="booking-notice"><b>${esc(note.title||'حجز جديد')}</b> <span>${esc(note.booking_number||'')}</span> <small>${esc(label)}</small></div>`;
    }).join('');
    document.getElementById('bookingTable').className='booking-table-wrap';
    document.getElementById('bookingTable').innerHTML=bookingRows.length?`<table class="booking-table"><thead><tr><th>الحجز والعميل</th><th>المناسبة والخدمات</th><th>القيمة والمصدر</th><th>الحالة والمتابعة</th><th>التفاصيل</th></tr></thead><tbody>${bookingRows.map(b=>{
      const e=b.event_snapshot||{},c=b.contact||{};
      return `<tr><td><b>${esc(b.booking_number)}</b><span>${esc(b.contact_name||b.customer_name||c.name||'—')}</span><a href="tel:${esc(b.contact_phone||b.customer_phone||c.phone||'')}">${esc(b.contact_phone||b.customer_phone||c.phone||'—')}</a><small>${esc(when(b.created_at))}</small></td><td>${esc(b.occasion||e.occasion||'—')}<small>${esc(b.event_date||e.event_date||e.date||'لم يحدد')}</small><span>${n(b.guest_count)} مدعو • ${esc(b.package_name||b.package_code||'—')}</span><small>التصميم: ${esc(b.template||e.template||'—')}</small><small>${esc(Array.isArray(b.services_json)?b.services_json.map(x=>typeof x==='string'?x:x.name||x.id).join('، '):'—')}</small></td><td><b>${money(b.total_amount)}</b><small>خصم ${money(b.discount_amount)}</small><small>المصدر: ${esc(b.source||b.attribution?.source||'غير معروف')}</small><small>الإحالة: ${esc(b.referral_code||'بدون')} ${esc(b.partner_name||'')}</small></td><td><span>${esc(H().label(b.booking_status))}</span><small>${esc(H().label(b.payment_status))}</small><small>المسؤولة: ${esc(b.assigned_name||b.assigned_user_id||'لم تعين')}</small><small>آخر متابعة: ${esc(when(b.last_follow_up_at))}</small><small>المتابعة التالية: ${esc(when(b.next_follow_up_at))}</small></td><td><button class="gold-btn small" data-edit-booking="${esc(b.id)}">فتح ومتابعة</button></td></tr>`;
    }).join('')}</tbody></table>`:'<p class="portal-empty">لا توجد حجوزات مطابقة حتى الآن.</p>';
    document.getElementById('bookingPage').textContent=`صفحة ${n(bookingFilters.page)} • ${n(d.total??bookingRows.length)} طلب`;
    document.getElementById('bookingPrevious').disabled=bookingFilters.page<=1;
    document.getElementById('bookingNext').disabled=!(d.hasMore??bookingRows.length>=50);
    document.querySelectorAll('[data-edit-booking]').forEach(button=>button.onclick=()=>openFollowup('booking',bookingRows.find(b=>b.id===button.dataset.editBooking)));
    const target=new URLSearchParams(location.search).get('booking');if(target&&bookingRows.some(b=>b.id===target)){openFollowup('booking',bookingRows.find(b=>b.id===target));history.replaceState(null,'',location.pathname+'#adminBookings');}
  }catch(error){workspaceError('bookingTable',error);}
}
async function loadLeads(){
  try{
    const d=await api('/api/admin/leads');leadRows=d.leads||[];
    document.getElementById('leadTable').className='booking-table-wrap';
    document.getElementById('leadTable').innerHTML=leadRows.length?`<table class="booking-table"><thead><tr><th>العميل</th><th>الاهتمام والمصدر</th><th>التواصل</th><th>الموافقة</th><th>المتابعة</th></tr></thead><tbody>${leadRows.map(l=>`<tr><td><b>${esc(l.name||l.customer_name||'لم يذكر الاسم')}</b><span>${esc(l.phone||l.customer_phone||l.email||'—')}</span><small>${esc(when(l.created_at))}</small></td><td>${esc(l.service||l.kind||'—')}<small>${esc(l.source?.source||l.attribution?.source||'غير معروف')}</small><small>الحجوزات: ${esc((l.bookings||[]).map(b=>b.booking_number).join('، ')||String(l.booking_count||0))}</small></td><td>${esc(H().label(l.contact_status||'new'))}<small>المسؤولة: ${esc(l.assigned_name||l.assigned_user_id||'لم تعين')}</small><small>آخر متابعة: ${esc(when(l.last_follow_up_at))}</small></td><td>${l.marketing_consent?'وافق على التسويق':'لم يوافق على التسويق'}</td><td><button class="gold-btn small" data-edit-lead="${esc(l.id)}">متابعة</button></td></tr>`).join('')}</tbody></table>`:'<p class="portal-empty">لا توجد بيانات عملاء مهتمين حتى الآن.</p>';
    document.querySelectorAll('[data-edit-lead]').forEach(button=>button.onclick=()=>openFollowup('lead',leadRows.find(l=>l.id===button.dataset.editLead)));
  }catch(error){workspaceError('leadTable',error);}
}
function openFollowup(kind,row){
  if(!row)return;
  let dialog=document.getElementById('followupDialog');if(dialog)dialog.remove();
  dialog=document.createElement('dialog');dialog.id='followupDialog';dialog.className='followup-dialog';
  const isBooking=kind==='booking',phone=row.contact_phone||row.customer_phone||row.phone||row.contact?.phone||'';
  const options=isBooking?['pre_booking_received','contacted','awaiting_confirmation','cancelled']:['new','contacted','follow_up','closed'];
  dialog.innerHTML=`<form id="followupForm" class="lead-form"><div class="panel-head"><h2>${esc(row.booking_number||row.name||'متابعة العميل')}</h2><button type="button" id="closeFollowup" class="ghost-btn">إغلاق</button></div>${isBooking?`<p>${esc(row.occasion||row.event_snapshot?.occasion||'')} • ${esc(row.event_date||row.event_snapshot?.event_date||'')} • ${n(row.guest_count)} مدعو</p><p>حالة الدفع: <b>${esc(H().label(row.payment_status))}</b> — الإجمالي: ${money(row.total_amount)}</p><details><summary>تفاصيل المناسبة والتصميم والإحالة</summary><pre class="booking-json">${esc(JSON.stringify({event:row.event_snapshot,services:row.services_json,attribution:row.attribution,referralCode:row.referral_code},null,2))}</pre></details>`:''}<label>${isBooking?'حالة الحجز':'حالة التواصل'}<select name="state">${isBooking&&!options.includes(row.booking_status)?`<option value="${esc(row.booking_status)}" selected>${esc(H().label(row.booking_status))}</option>`:''}${options.map(value=>`<option value="${value}" ${(isBooking?row.booking_status:row.contact_status)===value?'selected':''}>${esc(H().label(value))}</option>`).join('')}</select></label>${isBooking?`<label>حالة المتابعة<select name="followupStatus">${['new','contacted','follow_up','closed'].map(value=>`<option value="${value}" ${row.followup_status===value?'selected':''}>${esc(H().label(value))}</option>`).join('')}</select></label>`:''}<label>الموظفة المسؤولة<select name="assignedUserId"><option value="">دون إسناد</option>${bookingStaff.map(person=>`<option value="${esc(person.id)}" ${row.assigned_user_id===person.id?'selected':''}>${esc(person.name)}</option>`).join('')}</select></label><label>موعد المتابعة القادمة<input name="nextFollowUpAt" type="datetime-local" value="${row.next_follow_up_at?new Date(row.next_follow_up_at).toISOString().slice(0,16):''}"></label><label>ملاحظات داخلية<textarea name="notes" rows="4" maxlength="4000">${esc(row.notes||'')}</textarea></label><div class="event-actions"><button class="gold-btn" type="submit">حفظ المتابعة</button><a class="outline-btn dark-outline" href="${isBooking?H().whatsapp(row.booking_number):`https://wa.me/${encodeURIComponent(String(phone).replace(/\D/g,''))}`}" target="_blank" rel="noopener noreferrer">${isBooking?'استفسار فريق هلا عن الحجز':'محادثة العميل'}</a>${isBooking&&phone?`<a class="outline-btn dark-outline" href="https://wa.me/${encodeURIComponent(String(phone).replace(/\D/g,''))}?text=${encodeURIComponent('مرحبًا، معك فريق هلا بخصوص طلب الحجز رقم '+row.booking_number)}" target="_blank" rel="noopener noreferrer">التواصل مع العميل</a>`:''}</div><p id="followupNotice" role="status"></p></form>`;
  document.body.appendChild(dialog);dialog.showModal();document.getElementById('closeFollowup').onclick=()=>dialog.close();
  document.getElementById('followupForm').onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;
    try{const next=f.get('nextFollowUpAt');await api(isBooking?'/api/admin/bookings':'/api/admin/leads',{method:'PATCH',body:JSON.stringify({id:row.id,...(isBooking?{...(f.get('state')!==row.booking_status?{bookingStatus:f.get('state')}:{ }),followupStatus:f.get('followupStatus')}:{contactStatus:f.get('state')}),assignedUserId:f.get('assignedUserId')||null,notes:f.get('notes')||'',nextFollowUpAt:next?new Date(next).toISOString():null})});dialog.close();if(isBooking)loadBookings();else loadLeads();}
    catch(error){document.getElementById('followupNotice').textContent=error.message;button.disabled=false;}
  };
}
async function exportBookings(){
  const button=document.getElementById('exportBookings');button.disabled=true;
  try{const query=bookingQuery();query.set('format','csv');const response=await fetch('/api/admin/bookings?'+query,{headers:{authorization:`Bearer ${s.token}`}});if(!response.ok)throw new Error('تعذر تصدير الحجوزات');const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='HALA-bookings.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(error){alert(error.message);}finally{button.disabled=false;}
}
async function loadBookingSettings(){
  try{const data=await api('/api/admin/booking-settings');const form=document.getElementById('bookingSettingsForm');form.elements.supportPhone.value=data.supportPhone||'';form.elements.notificationPhone.value=data.notificationPhone||'';form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('/api/admin/booking-settings',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form)))});document.getElementById('bookingSettingsNotice').textContent='تم حفظ إعدادات التواصل.';}catch(error){document.getElementById('bookingSettingsNotice').textContent=error.message;}finally{button.disabled=false;}};}
  catch(error){document.getElementById('bookingSettingsNotice').textContent=error.message;}
}
async function loadInsights(){
  try{
    const d=await api('/api/admin/insights'),v=d.visits||{},b=d.bookings||{},i=d.interests||{},c=d.conversion||{};
    const percent=value=>(Number(value)||0).toLocaleString('ar-SA',{maximumFractionDigits:1})+'٪';
    const rows=(items,labelKey)=>items?.length?`<ul class="insight-list">${items.map(item=>`<li><span>${esc(item[labelKey]||'غير معروف')}</span><b>${n(item.count)}</b></li>`).join('')}</ul>`:'<p>لا توجد بيانات حتى الآن.</p>';
    document.getElementById('insightTable').className='';
    document.getElementById('insightTable').innerHTML=`<p class="booking-notice">${esc(d.scope?.visitorEstimateNote||'الزوار الفريدون تقدير وفق المعرفات المسموح بها، وليس عدد أشخاص موثقًا.')} • المنطقة الزمنية: ${esc(d.scope?.timezone||'Asia/Riyadh')}</p><div class="metrics-grid">${card('مشاهدات الصفحات',n(v.pageViews??v.total),'أحداث page_view فعلية')}${card('مشاهدات اليوم',n(v.today))}${card('مشاهدات ٧ أيام',n(v.sevenDays))}${card('مشاهدات ٣٠ يومًا',n(v.thirtyDays))}${card('الجلسات الفعلية',n(v.sessions),'معرفات جلسات مميزة')}${card('زوار فريدون تقديريًا',n(v.estimatedVisitors),'وفق موافقة ومعرف زائر')}${card('أحداث الاهتمام',n(i.events),'قد يصدر أكثر من حدث من العميل نفسه')}${card('عملاء مهتمون معروفون',n(i.knownLeads),'بيانات تواصل مسجلة فعليًا')}${card('طلبات حقيقية',n(b.total),n(b.today)+' اليوم')}${card('الحجوزات المسبقة',n(b.preBookings))}${card('بانتظار الدفع',n(b.pendingPayment))}${card('حجوزات مدفوعة',n(b.paid))}${card('ملغاة',n(b.cancelled))}${card('قيمة حجوزات محتملة',money(b.potentialValueHalalas),'ليست إيرادًا محققًا')}${card('إيرادات فعلية',money(b.realizedRevenueHalalas),'عمليات دفع متحققة')}${card('متوسط قيمة الطلب',money(b.averageOrderHalalas))}${card('زيارة ← بدء حجز',percent(c.visitToBookingStartPercent))}${card('إكمال رحلة الحجز',percent(c.bookingCompletionPercent))}${card('عميل معروف ← حجز',percent(c.knownLeadToBookingPercent))}${card('حجز مبدئي ← دفع',percent(c.prebookingToPaidPercent))}</div><div class="portal-grid"><article><h3>الصفحات الأكثر زيارة</h3>${rows(v.topPages,'path')}</article><article><h3>مصادر الزيارات</h3>${rows(v.sources,'source')}</article><article><h3>الأجهزة</h3>${rows(v.devices,'device_type')}</article><article><h3>أحداث الاهتمام</h3>${rows(i.byEvent,'event_name')}</article></div><details><summary>مصدر كل مؤشر وطريقة حسابه</summary><dl class="booking-details">${Object.entries(d.metricSources||{}).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(typeof value==='string'?value:JSON.stringify(value))}</dd></div>`).join('')||'<p>المصادر غير متاحة في هذه الاستجابة.</p>'}</dl></details>`;
  }catch(error){workspaceError('insightTable',error);}
}
