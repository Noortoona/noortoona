(function initHalaInsights(global) {
  'use strict';

  // Read-only suggestions: no automatic messages, purchases or guest-list changes.
  function summarize(event, guests) {
    const rows = Array.isArray(guests) ? guests : [];
    const pending = rows.filter(g => !g.rsvp_status || g.rsvp_status === 'pending');
    const declined = rows.filter(g => g.rsvp_status === 'declined');
    const failed = rows.filter(g => g.whatsapp_status === 'failed');
    const missingPhone = rows.filter(g => !String(g.phone || '').trim());
    const unopened = rows.filter(g =>
      ['sent', 'delivered', 'read'].includes(g.whatsapp_status) && !g.viewed_at
    );
    const accepted = rows.filter(g =>
      g.rsvp_status === 'accepted' && g.attendance_state !== 'waitlist'
    );
    const expected = accepted.reduce((sum, g) => {
      const companions = Math.max(0, Number(g.companion_count) || 0);
      const children = Math.max(0, Number(g.children_count) || 0);
      return sum + 1 + companions + children;
    }, 0);
    const capacity = Number(event?.capacity || 0);
    const items = [];

    if (!rows.length) {
      items.push({
        key: 'empty', level: 'info', title: 'ابدأ بقائمة المدعوين',
        detail: 'أضف ضيوفك أو استوردهم من Excel / CSV لتبدأ متابعة المناسبة.',
        filterKey: null, filterValue: null
      });
      return { items, expected, capacity };
    }
    if (failed.length) items.push({
      key: 'failed', level: 'urgent', title: `فشل إرسال ${failed.length} دعوة`,
      detail: 'راجع تفاصيل خطأ المزود أولًا. لا تعِد الإرسال قبل التأكد من النتيجة.',
      filterKey: null, filterValue: null
    });
    if (pending.length) items.push({
      key: 'pending', level: 'attention', title: `${pending.length} ضيف بانتظار تأكيد الحضور`,
      detail: 'استعرض غير المستجيبين وحدد من يحتاج متابعة. لن تُرسل رسائل تلقائيًا.',
      filterKey: 'status', filterValue: 'pending'
    });
    if (missingPhone.length) items.push({
      key: 'phone', level: 'attention', title: `${missingPhone.length} ضيف بدون رقم جوال`,
      detail: 'يمكن مشاركة رابط الدعوة يدويًا، لكن الإرسال الآلي يحتاج رقمًا صحيحًا.',
      filterKey: null, filterValue: null
    });
    if (declined.length) items.push({
      key: 'declined', level: 'info', title: `${declined.length} ضيف اعتذر عن الحضور`,
      detail: 'راجع إمكانية إضافة مدعوين بدلاء حسب سعة الباقة، دون افتراض استبدال مجاني.',
      filterKey: 'status', filterValue: 'declined'
    });
    if (unopened.length) items.push({
      key: 'unopened', level: 'info', title: `${unopened.length} رابط دعوة لم يُفتح بعد`,
      detail: 'هذا يعتمد على تسجيل فتح الرابط؛ ولا يعني بالضرورة أن رسالة واتساب لم تُقرأ.',
      filterKey: 'view', filterValue: 'unviewed'
    });
    if (capacity > 0 && expected >= capacity) items.push({
      key: 'capacity', level: 'attention', title: 'اكتملت السعة المحددة',
      detail: `الحضور المتوقع ${expected} من أصل ${capacity}. راجع قائمة الانتظار قبل إضافة مشاركين.`,
      filterKey: null, filterValue: null
    });
    if (!items.length) items.push({
      key: 'clear', level: 'info', title: 'لا توجد تنبيهات حالية',
      detail: 'راجع بيانات الحضور عند اقتراب موعد المناسبة، وتأكد من اختبار الدخول.',
      filterKey: null, filterValue: null
    });
    return { items, expected, capacity };
  }

  global.HALA_INSIGHTS = Object.freeze({ summarize });
})(typeof window !== 'undefined' ? window : globalThis);
