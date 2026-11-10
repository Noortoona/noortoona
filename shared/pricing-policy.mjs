// Public, credential-free policy shared by Netlify, the website and Expo.
export const POLICY_VERSION = 'hala-packages-2026-11-v2';
export const GUEST_COUNTS = [100, 250, 500];
export const PACKAGE_DEFAULTS = [
  {code:'hala_basic',name:'هلا الأساسية',nameEn:'HALA Essential',tagline:'دعوتك الأنيقة، بطريقتك.',taglineEn:'Your elegant invitation, your way.',priceTiers:{100:39900,250:79900,500:139900}},
  {code:'hala_plus',name:'هلا بلس',nameEn:'HALA Plus',tagline:'تفاصيل منظّمة، وراحة أكثر.',taglineEn:'Organized details. Greater peace of mind.',recommended:true,priceTiers:{100:84900,250:174900,500:299900}},
  {code:'hala_premium',name:'هلا بريميوم',nameEn:'HALA Premium',tagline:'تجربة استثنائية تليق بمناسبتك.',taglineEn:'An exceptional experience for your occasion.',priceTiers:{100:129900,250:269900,500:449900}},
];
const feature = (id, ar, en, status='included') => ({id,ar,en,status});
export const PACKAGE_FEATURES = {
  hala_basic:[
    feature('templates','قالب فاخر من المكتبة الأساسية','Luxury template from the essential library'),
    feature('customize','تخصيص الأسماء والنصوص والألوان','Customize names, text and colors'),
    feature('maps','موقع المناسبة عبر Google Maps','Google Maps event location'),
    feature('datetime','تقويم وأداة اختيار الوقت','Calendar and time picker'),
    feature('guests','إدارة قائمة المدعوين','Guest list management'),
    feature('contacts','اختيار جهات الاتصال بإذن المستخدم حيث تدعم المنصة','Contact selection with permission where supported'),
    feature('link','رابط دعوة قابل للمشاركة','Shareable invitation link'),
    feature('rsvp','تأكيد الحضور أو الاعتذار RSVP','Accept or decline with RSVP'),
    feature('qr','رمز QR خاص بكل مدعو','Unique QR code for every guest'),
    feature('manual','مشاركة الدعوات يدويًا عبر واتساب أو الروابط','Manual sharing through WhatsApp or links'),
    feature('responses','لوحة متابعة أساسية للردود','Essential response dashboard'),
    feature('self_entry','إدارة الدخول ذاتيًا بأدوات QR','Self-managed entry with QR tools'),
  ],
  hala_plus:[
    feature('extra_templates','قوالب إضافية وحصرية حسب الكتالوج المتاح','Additional exclusive templates from the available catalog'),
    feature('whatsapp','إرسال واتساب آلي بعد اكتمال التفعيل الرسمي','Automated WhatsApp after official activation','external'),
    feature('delivery','حالة الرسائل والتسليم وفق بيانات المزود','Message and delivery status provided by the provider','external'),
    feature('reminders','تذكيرات آلية وفق السياسات وبعد تفعيلها','Automated reminders after activation and policy approval','external'),
    feature('statistics','إحصائيات تفصيلية للمدعوين والردود','Detailed guest and response statistics'),
    feature('followup','متابعة المؤكدين والمعتذرين ومن لم يرد','Track accepted, declined and unanswered invitations'),
    feature('resend','إعادة الإرسال للمدعوين المسموح بمراسلتهم','Resend to guests who may be contacted','external'),
    feature('support','دعم عملاء بمستوى مميز','Priority customer support','assisted'),
  ],
  hala_premium:[
    feature('bespoke','تصميم خاص: دعوة ثابتة واحدة ضمن النطاق المتفق عليه','One bespoke static invitation within the agreed scope','assisted'),
    feature('revisions','جولتا تعديل على التصميم الخاص','Two revision rounds for the bespoke design','assisted'),
    feature('visual','خيارات تخصيص بصرية متقدمة','Advanced visual customization'),
    feature('setup','مساعدة شخصية في إعداد الدعوة','Personal invitation setup assistance','assisted'),
    feature('review','مراجعة المناسبة وقائمة المدعوين قبل الإرسال','Event and guest-list review before sending','assisted'),
    feature('support_max','أولوية قصوى في الدعم','Highest support priority','assisted'),
    feature('private','متابعة شخصية لإدارة المناسبة الرقمية','Personal assistance with digital event management','assisted'),
    feature('export','إحصائيات متقدمة وتقرير نهائي قابل للتصدير','Advanced statistics and an exportable final report'),
  ],
};
export const ENTRY_DEFAULTS = {unitAmount:59900,standardHours:null,enabled:true};
export const TAX_DEFAULTS = {status:'unconfigured',rateBps:null,pricesIncludeTax:null,registrationNumber:''};
export const BUSINESS_DEFAULTS = [
  {code:'business',name:'هلا أعمال',nameEn:'HALA Business',startingAmount:349900,features:['دعوات بهوية الجهة','إدارة الضيوف وRSVP وQR','لوحة متابعة وتقارير حضور','ألوان وشعار الجهة','دعم للفعاليات المهنية'],featuresEn:['Branded invitations','Guest management, RSVP and QR','Dashboard and attendance reports','Organization colors and logo','Support for professional events']},
  {code:'enterprise',name:'هلا المؤسسات',nameEn:'HALA Enterprise',startingAmount:699900,features:['تخصيص أوسع للهوية','مناسبات متعددة وفق الاتفاق','صلاحيات مناسبة للفريق','تقارير متقدمة','تكاملات عند توفرها وفق الاتفاق','دعم مخصص وتنظيم دخول عند إضافته للعرض'],featuresEn:['Extended brand customization','Multiple events by agreement','Appropriate team roles','Advanced reports','Integrations only when available and agreed','Dedicated support; entry organization quoted separately']},
];
export function defaultPackages(){return PACKAGE_DEFAULTS.map(p=>({...p,enabled:true,currency:'SAR',guestLimit:500,amount:p.priceTiers[100],amountSar:p.priceTiers[100]/100,priceTiers:{...p.priceTiers},features:PACKAGE_FEATURES[p.code].map(f=>({...f}))}));}
export function featuresFor(pkg,packages=defaultPackages()){
  const index=PACKAGE_DEFAULTS.findIndex(p=>p.code===pkg.code);
  return packages.filter(p=>PACKAGE_DEFAULTS.findIndex(d=>d.code===p.code)<=index).flatMap(p=>p.features||[]);
}
export function tierFor(pkg, count){
  const amount=pkg?.priceTiers?.[Number(count)];
  return Number.isInteger(amount)&&amount>0?{...pkg,amount,amountSar:amount/100,guestLimit:Number(count)}:null;
}
export function entryQuote(policy, count, details={}){
  const entrances=Number(details.entrances||1),hours=details.durationHours===''||details.durationHours==null?null:Number(details.durationHours);
  const preference=String(details.preference||''),organizers=Math.max(Number(count)>250?2:1,entrances,preference==='both'?2:1);
  if(!['male','female','both'].includes(preference)||!Number.isInteger(entrances)||entrances<1||hours!==null&&(!Number.isFinite(hours)||hours<=0||hours>24))return {error:'تحقق من نوع المنظم وعدد المداخل ومدة الاستقبال'};
  const customQuoteRequired=organizers>2||Number(count)>500||Boolean(policy.standardHours&&hours>policy.standardHours);
  return {organizers,entrances,preference,durationHours:hours,unitAmount:policy.unitAmount,amount:customQuoteRequired?null:organizers*policy.unitAmount,customQuoteRequired,availability:'pending_review',scopeUnverified:!policy.standardHours};
}
export function taxQuote(subtotal, policy=TAX_DEFAULTS){
  if(policy.status==='unconfigured')return {taxStatus:'unconfigured',taxAmount:null,taxRateBps:null,pricesIncludeTax:null,total:subtotal,provisional:true};
  if(policy.status==='not_registered')return {taxStatus:policy.status,taxAmount:0,taxRateBps:0,pricesIncludeTax:false,total:subtotal,provisional:false};
  const rate=policy.rateBps, tax=policy.pricesIncludeTax?Math.round(subtotal*rate/(10000+rate)):Math.round(subtotal*rate/10000);
  return {taxStatus:policy.status,taxAmount:tax,taxRateBps:rate,pricesIncludeTax:policy.pricesIncludeTax,total:subtotal+(policy.pricesIncludeTax?0:tax),provisional:false};
}
