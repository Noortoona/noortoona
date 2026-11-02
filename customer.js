(() => {
  const root=document.getElementById('customerRoot'),H=window.HALA_BOOKING,s=H.session(),esc=H.esc;
  document.getElementById('logoutBtn').onclick=async()=>{try{if(s?.token)await H.api('/api/auth/logout',{method:'POST'});}catch{}finally{localStorage.removeItem('halaSession');localStorage.removeItem('noortoonaOwner');location.href='/';}};
  if(!s?.token||s.user?.role!=='customer'){
    const recent=H.read('halaRecentBookings')||[];
    root.className='';root.innerHTML=`<section class="portal-panel"><h2>حجوزاتك في هذا المتصفح</h2>${recent.length?recent.map(b=>`<p><a class="gold-btn" href="/booking.html?id=${encodeURIComponent(b.id)}">${esc(b.number)}</a></p>`).join(''):'<p>لا توجد حجوزات محفوظة في هذا المتصفح حتى الآن.</p>'}<p>لرؤية الحجوزات المرتبطة بحسابك على أجهزتك، سجّل الدخول برقم الجوال.</p><button class="outline-btn dark-outline" id="customerLogin">تسجيل الدخول</button></section>`;
    document.getElementById('customerLogin').onclick=()=>{const script=document.createElement('script');script.src='/account.js';script.onload=async()=>{const auth=await window.HALA_AUTH.ensureLogin('customer');if(auth)location.reload();};document.body.appendChild(script);};return;
  }
  document.getElementById('customerName').textContent=s.user.name||('+'+s.user.phone);
  const status=v=>v==='assigned'?'تم تعيين المشرف':v==='requested'?'بانتظار تعيين مشرف':v==='completed'?'اكتملت خدمة المشرف':v==='canceled'?'ملغي':'بدون مشرف';
  async function load(){
    try{
      const [eventsData,bookingsData]=await Promise.all([H.api('/api/customer/home'),H.api('/api/bookings')]);
      const stored=H.read('halaRecentBookings')||[],bookings=bookingsData.bookings||[],known=new Set(bookings.map(b=>b.id));
      const other=await Promise.all(stored.filter(b=>!known.has(b.id)).map(async b=>{try{return(await H.api('/api/bookings?id='+encodeURIComponent(b.id),{headers:{'x-booking-token':H.access(b.id)}})).booking;}catch{return null;}}));
      bookings.push(...other.filter(Boolean));render(eventsData.events||[],bookings);
    }catch(error){root.innerHTML=`<div class="portal-empty"><h2>تعذر تحميل حسابك</h2><p>${esc(error.message)}</p></div>`;}
  }
  function render(events,bookings){
    root.className='';root.innerHTML=`<section class="portal-panel"><h2>حجوزاتي</h2><p>الحجز المبدئي لا يعني إتمام الدفع أو التأكيد النهائي.</p><div class="customer-events">${bookings.length?bookings.map(b=>`<article class="customer-event"><h3>${esc(b.booking_number)}</h3><p>${esc(b.event_snapshot?.title||b.title||b.event_snapshot?.occasion||'')}</p><p>${esc(H.label(b.booking_status))} • ${esc(H.label(b.payment_status))}</p><strong>${H.money(b.total_amount)}</strong><div class="event-actions"><a class="gold-btn" href="/booking.html?id=${encodeURIComponent(b.id)}">عرض حجزي</a><a class="outline-btn dark-outline" href="${H.whatsapp(b.booking_number)}" target="_blank" rel="noopener noreferrer">خدمة العملاء</a></div></article>`).join(''):'<p>لا توجد حجوزات حتى الآن.</p>'}</div></section><h2>مناسباتي ودعواتي</h2><div class="customer-events">${events.length?events.map(e=>`<article class="customer-event"><div class="event-title"><span>${esc(e.occasion)}</span><h2>${esc(e.title)}</h2><p>${esc(e.city||'')} • ${esc(e.event_date||'لم يحدد التاريخ')}</p></div><div class="event-mini"><span><b>${Number(e.guests)||0}</b> ضيف</span><span><b>${Number(e.accepted)||0}</b> مؤكد</span><span><b>${Number(e.checked_in)||0}</b> حضر</span></div><div class="supervisor-strip"><div><b>مشرف المناسبة</b><span>${status(e.supervisor_status)}${e.supervisor_amount?' • '+H.money(e.supervisor_amount):''}</span></div><button data-supervisor="${esc(e.id)}" data-requested="${e.supervisor_status==='requested'||e.supervisor_status==='assigned'}" class="outline-btn dark-outline">${e.supervisor_status==='requested'||e.supervisor_status==='assigned'?'إلغاء الطلب':'أضف مشرف'}</button></div><div class="event-actions"><a class="gold-btn" href="/dashboard?event=${encodeURIComponent(e.id)}">فتح لوحة المناسبة</a></div></article>`).join(''):'<div class="portal-empty"><h2>ما عندك مناسبة بعد</h2><a class="gold-btn" href="/">ابدأ حجزك الآن</a></div>'}</div>`;
    document.querySelectorAll('[data-supervisor]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await H.api('/api/events/supervisor',{method:'POST',body:JSON.stringify({eventId:button.dataset.supervisor,requested:button.dataset.requested!=='true'})});await load();}catch(error){alert(error.message);button.disabled=false;}});
  }
  load();
})();
