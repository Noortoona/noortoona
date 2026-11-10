import { readCatalog, catalogPackage } from './catalog.mjs';
import { activePartner, normalizeReferralCode, referralAmounts } from './partners.mjs';
import { supervisorAddonHalalas } from './settings.mjs';
import { POLICY_VERSION, entryQuote, taxQuote } from '../../../shared/pricing-policy.mjs';
import { normalizePhone } from './domain.mjs';
export const bookingError=(message,status=400)=>Object.assign(new Error(message),{status});
export const validPhone=value=>/^9665\d{8}$/.test(normalizePhone(value));
export function bookingContact(raw={}){
 const name=String(raw.name||'').trim(),phone=normalizePhone(raw.phone),email=String(raw.email||'').trim().toLowerCase();
 if(name.length<2||name.length>120||!/[\p{L}]/u.test(name)||/[<>]/.test(name)||!validPhone(phone)||/(\d)\1{6}/.test(phone)||email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180))throw bookingError('تحقق من الاسم ورقم الجوال والبريد');
 return {name,phone,email:email||null};
}
export async function bookingSettings(db){
 const rows=await db.sql`SELECT key,value FROM platform_settings WHERE key IN ('support_phone','booking_notification_phone')`;
 const values=Object.fromEntries(rows.map(r=>[r.key,r.value]));
 return {supportPhone:values.support_phone||'966532763736',notificationPhone:values.booking_notification_phone||'966532763736',supervisorAddonAmount:await supervisorAddonHalalas(db)};
}
export async function quoteBooking(db,body,userId='',event=null){
 const catalog=await readCatalog(db);
 if(!event&&body.eventId)event=(await db.sql`SELECT package_name,referral_code FROM events WHERE id=${String(body.eventId)} LIMIT 1`)[0];
 const selected=catalogPackage(catalog,body.packageCode||event?.package_name||'hala_plus',body.guestCount);
 const guestCount=Number(body.guestCount),services=body.services||[];
 if(!selected||!Number.isInteger(guestCount)||guestCount<1||guestCount>selected.guestLimit)throw bookingError('اختر 100 أو 250 أو 500 مدعو؛ للأعداد الأخرى اطلب عرض سعر مخصص',422);
 if(!Array.isArray(services)||services.length>1||services.some(id=>id!=='supervisor'))throw bookingError('الخدمة الإضافية غير متاحة للتسعير');
 const entry=services.includes('supervisor')?entryQuote(catalog.entry,guestCount,{...body.entryDetails,preference:body.supervisorPreference||body.entryDetails?.preference}):null;
 if(entry?.error)throw bookingError(entry.error);
 if(entry&&(!catalog.entry.enabled||entry.customQuoteRequired))throw bookingError('تفاصيل تنظيم الدخول تتطلب عرض سعر مخصص',422);
 const addon=entry?.amount||0;
 const rawCode=body.referralCode===undefined?event?.referral_code||'':body.referralCode;
 const code=normalizeReferralCode(rawCode);
 if(rawCode&&!code)throw bookingError('كود الإحالة غير صالح');
 const partner=code?await activePartner(db,code,userId||'guest'):null;
 if(code&&!partner)throw bookingError('كود الإحالة غير متاح');
 const amounts=referralAmounts(selected.amount,addon,partner);
 const tax=taxQuote(amounts.total,catalog.tax);
 const policySnapshot={version:POLICY_VERSION,revision:catalog.revision,packageCode:selected.code,guestCount,priceTiers:{...selected.priceTiers},tax:{...catalog.tax},entry:entry?{...catalog.entry,...entry}:null,discount:{code:partner?.code||null,discountAmount:amounts.discountAmount}};
 return {quote:{baseAmount:selected.amount,addonAmount:addon,discountAmount:amounts.discountAmount,...tax,currency:'SAR',packageCode:selected.code,packageName:selected.name,guestLimit:selected.guestLimit,guestCount,entry,policyVersion:POLICY_VERSION,catalogRevision:catalog.revision,policySnapshot,paymentEligible:!tax.provisional&&!entry},partner,commissionAmount:amounts.commissionAmount,services:entry?[{id:'supervisor',name:'تنظيم الدخول',amount:addon,...entry}]:[]};
}
export function customerBooking(row){
 if(!row)return null;
 const {access_token_hash,request_hash,idempotency_key,notes,assigned_user_id,followup_status,next_follow_up_at,last_follow_up_at,commission_amount,partner_user_id,...safe}=row;
 return safe;
}
export async function auditBooking(client,actor,action,id,metadata={}){
 await client.query('INSERT INTO audit_log(id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[crypto.randomUUID(),actor||null,action,'booking',id,JSON.stringify(metadata)]);
}
