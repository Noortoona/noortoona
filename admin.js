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
      if(session.user?.role!=="admin"){
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
  if(session?.user?.role==="admin"){s=session;load()}
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
      ${card("زوار 7 أيام",n(x.uniqueVisitors7d),"زوار فريدون")}
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
        ${requests.length?requests.map(r=>`<div class="supervisor-request"><div><b>${esc(r.title)}</b><span>${esc(r.customer_name||"")} • ${esc(r.customer_phone||"")}</span><small>${esc(r.city||"")} • ${esc(r.event_date||"")}</small></div><div><strong>${money(r.amount)}</strong><span class="request-status">${esc(r.status)}</span></div><div>${r.status==="requested"?`<select data-request-select="${r.id}"><option value="">اختر مشرفًا</option>${supervisors.map(su=>`<option value="${su.id}">${esc(su.name)} • ${esc(su.phone||"")}</option>`).join("")}</select><button class="gold-btn small" data-assign-request="${r.id}">تعيين</button>`:`<b>${esc(r.supervisor_name||"بانتظار التعيين")}</b><small>${esc(r.supervisor_phone||"")}</small>`}</div></div>`).join(""):"<p>لا توجد طلبات مشرف حاليًا.</p>"}
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
  document.getElementById('addCatalogService').onclick=()=>rows.insertAdjacentHTML('beforeend',serviceRow({id:crypto.randomUUID(),name:'',description:'',enabled:true}));
}

function catalogNotice(message){const notice=document.getElementById("catalogResult");if(notice)notice.textContent=message;else alert(message)}
