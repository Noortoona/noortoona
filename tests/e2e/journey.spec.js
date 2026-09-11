import { test, expect } from '@playwright/test';

test('رحلة إنشاء نشاط بادل كاملة على iPhone', async ({ page }) => {
  await page.route('**/api/events', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ event: { id: 'event-e2e' }, ownerToken: 'owner-e2e' }),
  }));
  await page.goto('/');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  await page.locator('[data-start]:visible').first().click();
  await page.locator('[data-occasion="activity"]').click();
  await expect(page.getByRole('heading', { name: 'اختر النشاط' })).toBeVisible();
  await page.locator('[data-activity="padel"]').click();
  await page.locator('#nextBtn').click();
  await expect(page.getByRole('heading', { name: /تفاصيل بادل/ })).toBeVisible();
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
  await page.getByRole('button', { name: 'نعم، سأحضر' }).last().click();
  await page.locator('#companionCount').selectOption('2');
  await expect(page.locator('#shareCalc')).toContainText(/105|١٠٥/);
  await page.locator('.companion-name').nth(0).fill('سعد');
  await page.locator('.companion-name').nth(1).fill('خالد');
  await page.locator('#shareConsent').check();
  await page.locator('#confirmRsvp').click();
  await expect(page.locator('#rsvpResult')).toContainText('تم تأكيد حضورك مع 2 مرافق');
});

test('لوحة المضيف تخفي الرمز وتدعم تسجيل QR اليدوي', async ({ page }) => {
  const payload = { event: { id: 'event-e2e', title: 'ليلة نورتونا', location: 'الرياض', occasion: 'زواج', capacity: null }, guests: [] };
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
