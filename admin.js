const root=document.getElementById("adminRoot");
const s=JSON.parse(localStorage.getItem("halaSession")||"null");
const esc=x=>String(x??"").replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[m]));
const n=x=>Number(x||0).toLocaleString("ar-SA");
const money=x=>(Number(x||0)/100).toLocaleString("ar-SA",{maximumFractionDigits:2})+" ر.س";
document.getElementById("logoutBtn").onclick=()=>{localStorage.removeItem("halaSession");location.href="/"};

if(!s?.token||s.user?.role!=="admin"){location.href="/"}else load();

async function api(url,opt={}){
  const r=await fetch(url,{...opt,headers:{"content-type":"application/json",authorization:`Bearer ${s.token}`,...(opt.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||"تعذر تنفيذ الطلب");
  return d;
}
function card(label,value,sub=""){return `<article class="metric-card"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`}
async function load(){
  try{
    const [overview,usersData,supData,settings]=await Promise.all([api("/api/admin/overview"),api("/api/admin/users"),api("/api/admin/supervisors"),api("/api/admin/settings")]);
    render(overview,usersData.users||[],supData,settings);
  }catch(e){
    root.innerHTML=`<div class="portal-empty"><h2>تعذر فتح لوحة الإدارة</h2><p>${esc(e.message)}</p></div>`;
  }
}
function render(d,users,supData,settings){
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

    <section class="portal-panel admin-supervisor-panel">
      <div class="panel-head"><div><span class="eyebrow dark">المشرفون</span><h2>طلبات مشرف المناسبة</h2></div>
      <form id="createSupervisorForm" class="inline-admin-form"><input name="name" placeholder="اسم المشرف" required><input name="phone" inputmode="tel" placeholder="05XXXXXXXX" required><button class="gold-btn" type="submit">إضافة مشرف</button></form></div>
      <div class="supervisor-admin-list">
        ${requests.length?requests.map(r=>`<div class="supervisor-request"><div><b>${esc(r.title)}</b><span>${esc(r.customer_name||"")} • ${esc(r.customer_phone||"")}</span><small>${esc(r.city||"")} • ${esc(r.event_date||"")}</small></div><div><strong>${money(r.amount)}</strong><span class="request-status">${esc(r.status)}</span></div><div>${r.status==="requested"?`<select data-request-select="${r.id}"><option value="">اختر مشرفًا</option>${supervisors.map(su=>`<option value="${su.id}">${esc(su.name)} • ${esc(su.phone||"")}</option>`).join("")}</select><button class="gold-btn small" data-assign-request="${r.id}">تعيين</button>`:`<b>${esc(r.supervisor_name||"بانتظار التعيين")}</b><small>${esc(r.supervisor_phone||"")}</small>`}</div></div>`).join(""):"<p>لا توجد طلبات مشرف حاليًا.</p>"}
      </div>
    </section>

    <section class="portal-grid admin-lower-grid">
      <article class="portal-panel">
        <h2>أحدث عمليات الدفع</h2>
        <div class="portal-list">${d.recentPayments.map(p=>`<div><b>${esc(p.customer_name||"عميل")}</b><span>${money(Number(p.amount||0))} • ${esc(p.status)}</span><small>${new Date(p.created_at).toLocaleString("ar-SA")}</small></div>`).join("")||"<p>لا توجد عمليات دفع بعد</p>"}</div>
      </article>
      <article class="portal-panel">
        <h2>الحسابات</h2>
        <div class="portal-list users-list">${users.slice(0,20).map(u=>`<div><b>${esc(u.name||"بدون اسم")}</b><span>${esc(u.role)} • ${esc(u.phone||u.email||"")}</span><small>${esc(u.status||"")}</small></div>`).join("")||"<p>لا توجد حسابات بعد</p>"}</div>
      </article>
    </section>

    <section class="portal-panel">
      <h2>سجل العمليات</h2>
      <div class="ops-table">${d.recentOps.map(o=>`<div><b>${esc(o.action)}</b><span>${esc(o.actor_name||"النظام")}</span><span>${esc(o.entity_type||"")} ${esc(o.entity_id||"")}</span><small>${new Date(o.created_at).toLocaleString("ar-SA")}</small></div>`).join("")||"<p>لا توجد عمليات بعد</p>"}</div>
    </section>`;

  document.getElementById("supervisorPriceForm")?.addEventListener("submit",saveSupervisorPrice);
  document.getElementById("createSupervisorForm")?.addEventListener("submit",createSupervisor);
  document.querySelectorAll("[data-assign-request]").forEach(b=>b.addEventListener("click",()=>assignSupervisor(b.dataset.assignRequest)));
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
