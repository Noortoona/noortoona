(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const session = () => read('halaSession');
  const tokens = () => read('halaBookingAccess') || {};
  const access = id => tokens()[id] || '';
  const remember = (booking, token) => { const all = tokens(); if (token) all[booking.id] = token; localStorage.setItem('halaBookingAccess', JSON.stringify(all)); const recent = read('halaRecentBookings') || []; localStorage.setItem('halaRecentBookings', JSON.stringify([{id:booking.id, number:booking.booking_number}, ...recent.filter(x => x.id !== booking.id)].slice(0, 30))); };
  const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
  let supportPhone = '966532763736';
  const settingsReady = fetch('/api/public-settings').then(r => r.ok ? r.json() : null).then(data => { if (/^9665\d{8}$/.test(data?.supportPhone || '')) supportPhone = data.supportPhone; document.querySelectorAll('[data-hala-support]').forEach(a => { a.href = whatsapp(a.dataset.bookingNumber || ''); }); return data; }).catch(() => null);
  const whatsapp = number => `https://wa.me/${supportPhone}?text=${encodeURIComponent(number ? `مرحبًا فريق هلا، لدي استفسار بخصوص حجزي رقم ${number}` : 'مرحبًا فريق هلا، أود الاستفسار عن خدمات هلا')}`;
  const context = () => window.HALA_ANALYTICS?.context?.() || {attribution:{},sessionId:null,visitorId:null};
  const track = (name, metadata = {}) => window.HALA_ANALYTICS?.track?.(name, metadata);
  async function api(url, options = {}) {
    const headers = {'content-type':'application/json', ...(session()?.token ? {authorization:`Bearer ${session().token}`} : {}), ...(options.headers || {})};
    const response = await fetch(url, {...options, headers});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'تعذر إكمال الطلب. حاول مرة أخرى.'), {status:response.status});
    return data;
  }
  const labels = {completed:'مكتمل',not_requested:'غير مطلوبة',pending_review:'قيد مراجعة التوفر',available:'التوفر مراجع',unavailable:'غير متاحة',assigned:'تم التكليف',pre_booking_received:'تم استلام الحجز المبدئي',confirmed:'مؤكد',cancelled:'ملغي',canceled:'ملغي',pending_payment:'بانتظار الدفع',paid:'مدفوع',new:'جديد',contacted:'تم التواصل',follow_up:'متابعة لاحقة',awaiting_confirmation:'بانتظار التأكيد',awaiting_customer:'بانتظار العميل',closed:'مغلق',queued:'في قائمة الإرسال',sent:'أُرسل',delivered:'تم التسليم',read:'تمت القراءة',pending_setup:'بانتظار إعداد واتساب',awaiting_setup:'بانتظار إعداد واتساب',failed:'فشل الإرسال'};
  const label = value => labels[value] || value || '—';
  const money = value => (Number(value || 0)/100).toLocaleString('ar-SA',{maximumFractionDigits:2}) + ' ر.س';
  window.HALA_BOOKING = {api,esc,read,session,secret,remember,access,context,track,whatsapp,settingsReady,label,money};
})();
