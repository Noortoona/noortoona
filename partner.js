const root=document.getElementById('partnerRoot');
const session=JSON.parse(localStorage.getItem('halaSession')||'null');
const esc=x=>String(x??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const money=x=>(Number(x||0)/100).toLocaleString('ar-SA',{maximumFractionDigits:2})+' ر.س';
document.getElementById('logoutBtn').onclick=()=>{localStorage.removeItem('halaSession');location.href='/'};
if(!session?.token||session.user?.role!=='partner')location.href='/';
else fetch('/api/partner/home',{headers:{authorization:`Bearer ${session.token}`}}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'تعذر تحميل الشراكة');return d}).then(d=>{
  const link=`${location.origin}/?ref=${encodeURIComponent(d.profile.code)}`;
  root.className='portal-grid';root.innerHTML=`<article class="portal-panel"><h2>${d.profile.kind==='venue'?'شريك قاعة':'شريك مشهور'}</h2><p>حالة الشراكة: ${d.profile.status==='active'?'نشطة':'متوقفة'}</p><p>الكود: <strong>${esc(d.profile.code)}</strong></p><p>العمولة: ${Number(d.profile.commission_bps)/100}% من الباقة بعد الخصم</p><p>خصم العميل: ${Number(d.profile.discount_bps)/100}% من الباقة</p><p><a id="partnerLink" href="${esc(link)}">${esc(link)}</a></p><button id="copyReferral" class="gold-btn">نسخ رابط الإحالة</button></article><article class="portal-panel"><h2>الأداء</h2><p>عملاء جدد: ${Number(d.summary?.customers||0)}</p><p>عمولات مستحقة: ${money(d.summary?.due)}</p><p>عمولات مسجلة كمدفوعة: ${money(d.summary?.paid)}</p><div class="portal-list">${d.commissions.map(c=>`<div><b>${money(c.amount)}</b><span>${esc(c.status)}</span><small>${new Date(c.created_at).toLocaleDateString('ar-SA')}</small></div>`).join('')||'<p>لا توجد عمولات بعد</p>'}</div></article>`;
  document.getElementById('copyReferral').onclick=()=>navigator.clipboard.writeText(link).then(()=>alert('تم نسخ الرابط'));
}).catch(e=>{root.innerHTML=`<div class="portal-empty"><h2>تعذر تحميل الشراكة</h2><p>${esc(e.message)}</p></div>`});
