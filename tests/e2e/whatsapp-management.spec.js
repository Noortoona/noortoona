import {test,expect} from '@playwright/test';

test('admin WhatsApp management reports actual missing setup and escapes incoming text',async({page,request})=>{
  const {admin}=await(await request.get('/__test/state')).json();
  await page.addInitScript(token=>{
    localStorage.setItem('halaSession',JSON.stringify({token,user:{id:'browser-admin',role:'admin'}}));
    localStorage.setItem('halaAnalyticsConsent','no');
  },admin);
  await page.goto('/admin.html');
  const panel=page.locator('#whatsappManagement');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('+966510654663');
  await expect(panel).toContainText('غير مضبوطة');
  await expect(panel).toContainText('لم يُرصد');
  await panel.getByRole('button',{name:'فحص المزود والقوالب'}).click();
  await expect(panel).toContainText('not_configured');
  await page.route('**/api/admin/whatsapp',async route=>{
    const response=await route.fetch(),data=await response.json();
    data.inbox=[{message_id:'wamid.ui',sender_phone:'********0001',message_type:'text',body:'<img src=x onerror=alert(1)>',received_at:new Date().toISOString(),resolved_at:null}];
    await route.fulfill({response,json:data});
  });
  await panel.getByRole('button',{name:'تحديث السجلات'}).click();
  await expect(panel).toContainText('<img src=x onerror=alert(1)>');
  await expect(panel.locator('img')).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'تحديد كمعالجة'})).toBeVisible();
});

test('customer service cannot see WhatsApp inbox or use its API',async({page,request})=>{
  const {staff}=await(await request.get('/__test/state')).json();
  await page.addInitScript(token=>localStorage.setItem('halaSession',JSON.stringify({token,user:{id:'browser-staff',role:'customer_service'}})),staff);
  await page.goto('/admin.html');
  await expect(page.locator('#bookingWorkspace')).toBeVisible();
  await expect(page.locator('#whatsappManagement')).toHaveCount(0);
  expect((await request.get('/api/admin/whatsapp',{headers:{authorization:'Bearer '+staff}})).status()).toBe(403);
});
