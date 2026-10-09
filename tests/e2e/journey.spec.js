import { test, expect } from '@playwright/test';

test('رحلة إنشاء نشاط بادل كاملة على iPhone', async ({ page }) => {
  await page.route('**/api/events', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ event: { id: 'event-e2e' }, ownerToken: 'owner-e2e' }),
  }));
  await page.addInitScript(() => localStorage.setItem('halaSession', JSON.stringify({ token: 'test-session', user: { id: 'test-user', role: 'customer' } })));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'test-user', role: 'customer' } }) }));
  await page.goto('/');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  await page.locator('[data-start]:visible').first().click();
  await page.locator('[data-occasion="activity"]').click();
  await expect(page.getByRole('heading', { name: 'اختر النشاط' })).toBeVisible();
  await page.locator('[data-activity="padel"]').click();
  await page.locator('#nextBtn').click();
  await expect(page.getByRole('heading', { name: /تفاصيل النشاط — بادل/ })).toBeVisible();
  await page.locator('#name1').fill('بادل الخميس');
  await page.locator('#location').fill('ملعب الرياض');
  await page.locator('#nextBtn').click();
  await expect(page.locator('.visual-template-card')).toHaveCount(4);
  expect(await page.locator('#builderBody').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.locator('.visual-template-card').nth(1).click();
  await page.locator('#nextBtn').click();
  await expect(page.locator('.host-phone .invite-canvas')).toBeVisible();
  expect(await page.locator('#builderBody').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect(page.locator('.host-phone')).toContainText('بادل الخميس');
  await page.locator('[data-full-preview]').click();
  await expect(page.locator('#journeyFullPreview .invite-canvas')).toBeVisible();
  await page.locator('#journeyFullPreview > button').click();
  await page.locator('#nextBtn').click();
  await page.locator('#nextBtn').click();
  await expect(page.getByRole('heading', { name: 'راجع دعوتك' })).toBeVisible();
  await page.locator('#nextBtn').click();
  await expect(page.getByText('كل شيء جاهز')).toBeVisible();
  await page.locator('#nextBtn').click();
  await expect(page).toHaveURL(/\/dashboard\?event=event-e2e/);
});

test('دعوة الضيف تحسب القطّة وتسجل الرد', async ({ page }) => {
  const invite = {
    guest_name: 'محمد', event_id: 'event-e2e', title: 'بادل الخميس', occasion: 'تجمع ونشاط',
    name1: 'بادل الخميس', name2: '', event_date: '2026-12-14', event_time: '20:00',
    activity_type: 'بادل', capacity: 20, share_amount: 35, share_label: 'قيمة القطّة',
    require_share_consent: true, allow_named_companions: true, waitlist_enabled: true,
    country: 'السعودية', city: 'الرياض', location: 'ملعب الرياض', maps_url: '', description: '',
    video_url: '', pdf_url: '', message: 'حياكم', template: 'Padel Night',
    design_json: { occasionKey: 'activity', activityKey: 'padel', showQr: true }, rsvp_status: 'pending',
    companion_count: 0, children_count: 0, attendance_state: 'normal',
  };
  await page.route('**/api/invite?code=TESTQR', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invite }) }));
  await page.route('**/api/rsvp', async route => {
    const body = route.request().postDataJSON();
    expect(body.companionCount).toBe(2);
    expect(body.companionNames).toEqual(['سعد', 'خالد']);
    expect(body.shareConsent).toBe(true);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ guest: { rsvp_status: 'accepted', companion_count: 2, children_count: 0, attendance_state: 'normal' } }) });
  });
  await page.goto('/guest.html?code=TESTQR');
  await expect(page.locator('.invite-canvas')).toContainText('محمد');
  await page.getByRole('button', { name: 'نعم، سأشارك' }).last().click();
  await page.locator('#companionCount').selectOption('2');
  await expect(page.locator('#shareCalc')).toContainText(/105|١٠٥/);
  await page.locator('.companion-name').nth(0).fill('سعد');
  await page.locator('.companion-name').nth(1).fill('خالد');
  await page.locator('#shareConsent').check();
  await page.locator('#confirmRsvp').click();
  await expect(page.locator('#rsvpResult')).toContainText('تم تأكيد حضورك مع 2 مرافق');
});

test('لوحة المضيف تخفي الرمز وتدعم تسجيل QR اليدوي', async ({ page }) => {
  const payload = { event: { id: 'event-e2e', title: 'ليلة هلا', location: 'الرياض', occasion: 'زواج', capacity: null }, guests: [] };
  await page.route('**/api/dashboard?event=event-e2e', async route => {
    expect(route.request().headers()['x-noortoona-owner-token']).toBe('secret-owner');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.route('**/api/check-in', async route => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ eventId: 'event-e2e', code: 'AB12CD34' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, guest: { name: 'محمد', rsvp_status: 'accepted', companion_count: 0, children_count: 0 }, alreadyCheckedIn: false }) });
  });
  await page.goto('/dashboard.html?event=event-e2e&token=secret-owner');
  await expect(page).toHaveURL('/dashboard.html?event=event-e2e');
  await page.getByRole('button', { name: /مسح QR/ }).click();
  await page.locator('#manualScanCode').fill('https://noortoona.com/i/AB12CD34');
  await page.getByRole('button', { name: 'تحقق' }).click();
  await expect(page.locator('.checkin-success')).toContainText('محمد');
  await expect(page.locator('.checkin-success')).toContainText('تم تسجيل الوصول');
});

test('قارئ QR يشغّل الكاميرا الخلفية ويسجل الوصول بعد قراءة الرمز', async ({ page }) => {
  const payload = { event: { id: 'event-camera', title: 'ليلة هلا', location: 'الرياض', occasion: 'تجمع ونشاط', activity_type: 'فيفا', capacity: 8, share_amount: 0 }, guests: [] };
  await page.route('https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.ZXingBrowser={BrowserMultiFormatReader:class{async decodeFromConstraints(constraints,video,callback){window.__cameraConstraints=constraints;const controls={stop(){window.__cameraStopped=true}};setTimeout(()=>callback({getText:()=>\"CAMERAQR\"},null,controls),20);return controls}}};`,
  }));
  await page.route('**/api/dashboard?event=event-camera', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
  await page.route('**/api/check-in', async route => {
    expect(route.request().postDataJSON()).toEqual({ eventId: 'event-camera', code: 'CAMERAQR' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, guest: { name: 'ضيف الكاميرا', rsvp_status: 'accepted', companion_count: 0, children_count: 0 }, alreadyCheckedIn: false }) });
  });

  await page.goto('/dashboard.html?event=event-camera&token=camera-owner');
  await page.getByRole('button', { name: /مسح QR/ }).click();
  await page.getByRole('button', { name: 'فتح الكاميرا' }).click();

  await expect(page.locator('.checkin-success')).toContainText('ضيف الكاميرا');
  await expect(page.locator('.checkin-success')).toContainText('تم تسجيل الوصول');
  expect(await page.evaluate(() => window.__cameraConstraints)).toEqual({ audio: false, video: { facingMode: { ideal: 'environment' } } });
});

test('إرسال واتساب لا يفتح الرقم الشخصي عند غياب الربط الرسمي', async ({ page }) => {
  const payload = {
    event: { id: 'event-wa', title: 'ليلة هلا', location: 'الرياض', occasion: 'زواج', capacity: null },
    guests: [{ id: 'guest-wa', name: 'ضيف واتساب', phone: '0500000000', code: 'WA123', rsvp_status: 'pending', whatsapp_status: 'idle' }],
  };
  await page.route('**/api/dashboard?event=event-wa', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
  await page.route('**/api/whatsapp/send', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'D360_NOT_CONFIGURED' }) }));
  let popupOpened = false;
  page.on('popup', () => { popupOpened = true; });

  await page.goto('/dashboard.html?event=event-wa&token=wa-owner');
  await page.getByRole('button', { name: 'إرسال واتساب', exact:true }).click();

  await expect(page.locator('#toast')).toContainText('مفتاح رقم هلا غير مضبوط');
  await expect(page).toHaveURL(/dashboard.html/);
  expect(popupOpened).toBe(false);
});

test('قبول الطلب يظهر قيد الإرسال ثم يتحدث إلى وصلت عند تأكيد المزود', async ({ page }) => {
 const guest={id:'delivery-guest',name:'ضيف التسليم',phone:'0500000000',code:'DELIVERY',rsvp_status:'pending',whatsapp_status:'idle'};
 const payload={event:{id:'delivery-event',title:'اختبار تسليم هلا',occasion:'زواج'},guests:[guest]};
 await page.route('**/api/dashboard?event=delivery-event',route=>route.fulfill({json:payload}));
 await page.route('**/api/whatsapp/send',route=>{
  guest.whatsapp_status='queued';guest.whatsapp_message_id='wamid.test.delivery';
  return route.fulfill({status:202,json:{accepted:true,messageId:guest.whatsapp_message_id,status:'queued',deliveryConfirmed:false}});
 });
 await page.goto('/dashboard.html?event=delivery-event&token=test-owner');
 await page.getByRole('button',{name:'إرسال واتساب',exact:true}).click();
 await expect(page.locator('.wa-state')).toHaveText('قيد الإرسال');
 await expect(page.locator('#toast')).toContainText('ننتظر تأكيد وصول');
 guest.whatsapp_status='sent';
 await expect(page.locator('.wa-state')).toHaveText('أُرسلت',{timeout:12000});
 await expect(page.locator('.wa-detail')).toContainText('لم يتأكد وصولها');
 guest.whatsapp_status='delivered';
 await expect(page.locator('.wa-state')).toHaveText('وصلت',{timeout:12000});
 await expect(page.locator('.wa-detail')).toHaveCount(0);
 guest.whatsapp_status='read';
 await expect(page.locator('.wa-state')).toHaveText('قُرئت',{timeout:12000});
 const mobileWidths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,table:document.querySelector('.table-wrap table').getBoundingClientRect().width}));
 expect(mobileWidths.page).toBeLessThanOrEqual(mobileWidths.viewport);
 expect(mobileWidths.table).toBeLessThanOrEqual(mobileWidths.viewport);
 await page.screenshot({path:'test-results/whatsapp-iphone.png',fullPage:true});
});

test('لوحة المشرف تعرض سبب الفشل ومعرف الرسالة دون تنفيذ محتوى الملاحظة', async ({ page }) => {
 await page.route('**/api/dashboard?event=failed-event',route=>route.fulfill({json:{
  event:{id:'failed-event',title:'اختبار الفشل',occasion:'زواج'},
  guests:[{id:'failed-guest',name:'ضيف',code:'FAIL',rsvp_status:'pending',whatsapp_status:'failed',whatsapp_message_id:'wamid.failure',whatsapp_error:JSON.stringify({code:131026,message:'Message undeliverable <script>window.injected=true</script>'})}]
 }}));
 await page.goto('/dashboard.html?event=failed-event&token=test-owner');
 await expect(page.locator('.wa-state')).toHaveText('فشل الإرسال');
 await expect(page.locator('.wa-detail')).toContainText('131026');
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();
});
