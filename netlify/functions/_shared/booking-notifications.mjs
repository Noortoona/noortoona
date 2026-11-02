import {providerConfig,providerError} from './whatsapp.mjs';
import {bookingSettings} from './bookings.mjs';
import {normalizePhone} from './domain.mjs';
export function bookingMessage(booking,origin){
 const e=booking.event_snapshot||{};
 return `هلا | حجز جديد ✨\nرقم الطلب: ${booking.booking_number}\nاسم العميل: ${booking.contact_name}\nالجوال: ${booking.contact_phone}\nالمناسبة: ${e.occasion||''}\nتاريخ المناسبة: ${e.event_date||''}\nعدد المدعوين: ${booking.guest_count}\nالباقة: ${booking.package_name}\nقيمة الطلب: ${(booking.total_amount/100).toFixed(2)} ر.س\nمصدر العميل: ${booking.attribution?.source||'غير معروف'}\nحالة الدفع: بانتظار الدفع\nرابط الطلب: ${origin}/admin.html?booking=${encodeURIComponent(booking.id)}`;
}
export async function notifyBooking(db,booking,origin){
 // Transactional outbox already exists. Sending is an independent best-effort step.
 const settings=await bookingSettings(db),get=k=>String(Netlify.env.get(k)||'');
 const sender=normalizePhone(get('D360_SENDER_PHONE')),recipient=settings.notificationPhone;
 let provider;
 try{provider=providerConfig(get);}catch{}
 const context=get('CONTEXT');
 const enabled=get('HALA_BOOKING_NOTIFICATIONS_ENABLED')==='true'&&get('D360_BOOKING_TEMPLATE_APPROVED')==='true'&&get('HALA_BOOKING_NOTIFICATION_RECIPIENT_CONFIRMED')==='true'&&get('D360_BOOKING_TEMPLATE')&&provider&&/^9665\d{8}$/.test(sender)&&sender!==recipient&&(context==='production'||get('HALA_BOOKING_NOTIFICATIONS_PREVIEW')==='true'&&provider.mode==='sandbox');
 if(!enabled)return {status:'pending_setup'};
 const rows=await db.sql`UPDATE booking_notifications SET status='queued',recipient=${recipient},attempted_at=NOW(),updated_at=NOW()
 WHERE booking_id=${booking.id} AND kind='whatsapp' AND event_name='booking.created' AND status='pending_setup' AND attempted_at IS NULL RETURNING id`;
 if(!rows[0])return {status:'already_attempted'};
 const id=rows[0].id,e=booking.event_snapshot||{};
 const parameters=[booking.booking_number,booking.contact_name,booking.contact_phone,e.occasion||'غير محدد',e.event_date||'غير محدد',String(booking.guest_count),booking.package_name,(booking.total_amount/100).toFixed(2),booking.attribution?.source||'غير معروف','بانتظار الدفع',`${origin}/admin.html?booking=${booking.id}`].map(text=>({type:'text',text:String(text)}));
 try{
  const r=await fetch(`${provider.apiBase}/messages`,{method:'POST',headers:{'D360-API-KEY':get('D360_API_KEY'),'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:recipient,type:'template',template:{name:get('D360_BOOKING_TEMPLATE'),language:{code:get('D360_TEMPLATE_LANGUAGE')||'ar'},components:[{type:'body',parameters}]}}),signal:AbortSignal.timeout(8000)});
  const payload=await r.json().catch(()=>null),messageId=payload?.messages?.[0]?.id;
  if(!r.ok){const error=providerError(payload);await db.sql`UPDATE booking_notifications SET status='failed',error_code=${error.code},updated_at=NOW() WHERE id=${id}`;return {status:'failed'};}
  if(!messageId)throw Error('MISSING_PROVIDER_ID');
  // API acceptance remains queued; only authenticated provider callbacks prove sent/delivery.
  await db.sql`UPDATE booking_notifications SET message_id=${String(messageId)},status=CASE WHEN status='queued' THEN 'queued' ELSE status END,updated_at=NOW() WHERE id=${id}`;
  return {status:'queued'};
 }catch{
  // An ambiguous timeout is never automatically resent: it could already be accepted.
  await db.sql`UPDATE booking_notifications SET status='failed',error_code='DISPATCH_UNCERTAIN',updated_at=NOW() WHERE id=${id}`;
  return {status:'failed'};
 }
}
