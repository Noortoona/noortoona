import{test,expect}from'@playwright/test';
const latin=s=>s.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬,]/g,'');
test('all package prices render from the shared catalog and respond to guest count',async({page,request})=>{
 const catalog=await(await request.get('/api/catalog')).json();expect(catalog.version).toBe(2);
 await page.goto('/#pricing');await expect(page.locator('#priceGrid article')).toHaveCount(3);
 for(const n of [100,250,500]){
  await page.locator('#pricingGuestCount').selectOption(String(n));
  for(const [i,pkg]of catalog.packages.entries())expect(latin(await page.locator('#priceGrid article').nth(i).locator('.price-number').textContent())).toContain(String(pkg.priceTiers[n]/100));
 }
 expect(await page.locator('#priceGrid .featured').count()).toBe(1);expect(await page.locator('#priceGrid del').count()).toBe(0);
 await page.locator('.hala-language-picker select').selectOption('en');await expect(page.locator('#priceGrid')).toContainText('HALA Plus');await expect(page.locator('#priceGrid')).toContainText('Entry organization is a separate add-on');
 await page.screenshot({path:test.info().outputPath('pricing-en.png'),fullPage:true});
});
test('booking API saves a priced request and makes it available to authorized administration',async({request})=>{
 const state=await(await request.get('/__test/state')).json(),headers={authorization:'Bearer '+state.admin};
 const e=await(await request.post('/api/events',{data:{title:'اختبار الأسعار المتكامل',name1:'عميل اختبار',occasion:'زواج',date:'2027-05-20',time:'20:00',city:'الرياض',location:'قاعة اختبار',template:'حديقة اللؤلؤ',package:'hala_plus',design:{occasionKey:'wedding'}}})).json();
 const body={eventId:e.event.id,ownerToken:e.ownerToken,packageCode:'hala_plus',guestCount:500,services:['supervisor'],supervisorPreference:'both',entryDetails:{entrances:2,durationHours:3,startTime:'19:00',city:'الرياض'},contact:{name:'عميل اختبار متكامل',phone:'0531234588'},idempotencyKey:crypto.randomUUID(),accessToken:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')};
 const q=await(await request.post('/api/bookings/quote',{data:body})).json();expect(q.quote.baseAmount).toBe(299900);expect(q.quote.addonAmount).toBe(119800);
 const response=await request.post('/api/bookings',{data:{...body,expectedTotal:q.quote.total}});expect(response.status()).toBe(201);const saved=(await response.json()).booking;expect(saved.payment_status).toBe('pending_payment');expect(saved.entry_status).toBe('pending_review');
 const replay=await request.post('/api/bookings',{data:{...body,expectedTotal:q.quote.total}});expect((await replay.json()).replayed).toBe(true);
 const list=await(await request.get('/api/admin/bookings?packageCode=hala_plus&guestCount=500',{headers})).json();expect(list.bookings.some(b=>b.id===saved.id&&b.pricing_snapshot.priceTiers[500]===299900)).toBe(true);
 const view=await request.get('/api/bookings?id='+saved.id,{headers:{'x-booking-token':body.accessToken}});expect(view.status()).toBe(200);
});
