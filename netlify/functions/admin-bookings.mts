import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {requireRole} from './_shared/auth.mjs';
import {isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {analyticsEnvironment} from './_shared/analytics.mjs';
import {auditBooking,bookingError} from './_shared/bookings.mjs';
const statuses=['pre_booking_received','contacted','awaiting_confirmation','confirmed','cancelled','completed'];
const csvCell=(value:any)=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
export default async(req:Request)=>{
 const auth=await requireRole(req,['admin','customer_service']);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 if(!['GET','PATCH'].includes(req.method))return new Response('Method Not Allowed',{status:405});
 if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 const db=getDatabase();let client:any;
 try{
  const environment=analyticsEnvironment();
  if(req.method==='GET'){
   const params=new URL(req.url).searchParams,q=String(params.get('q')||'').trim().slice(0,120),status=params.get('status')||params.get('bookingStatus')||'',payment=params.get('paymentStatus')||'';
   if(status&&!statuses.includes(status)||payment&&!['pending_payment','paid','refunded'].includes(payment))throw bookingError('التصفية غير صالحة');
   const page=Math.max(1,Math.min(10000,Number(params.get('page'))||1)),exporting=params.get('format')==='csv';
   const args:any[]=[environment,status,payment,'%'+q+'%'];const pkg=params.get('packageCode')||'',count=params.get('guestCount')||'';
   if(pkg&&!['hala_basic','hala_plus','hala_premium'].includes(pkg)||count&&!['100','250','500'].includes(count))throw bookingError('تصفية الباقة أو العدد غير صالحة');
   let where="b.environment=$1 AND ($2='' OR b.booking_status=$2) AND ($3='' OR b.payment_status=$3) AND (b.id ILIKE $4 OR b.booking_number ILIKE $4 OR b.contact_name ILIKE $4 OR b.contact_phone ILIKE $4)";
   if(pkg){args.push(pkg);where+=' AND b.package_code=$'+args.length}if(count){args.push(Number(count));where+=' AND b.guest_count=$'+args.length}
   client=await db.pool.connect();
   const rows=(await client.query(`SELECT b.*,e.title,e.occasion,e.event_date,e.location,u.name assigned_name FROM bookings b JOIN events e ON e.id=b.event_id LEFT JOIN users u ON u.id=b.assigned_user_id WHERE ${where} ORDER BY b.created_at DESC LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,exporting?10000:50,exporting?0:(page-1)*50])).rows;
   const bookings=rows.map(({access_token_hash,request_hash,idempotency_key,...row}:any)=>row);
   if(exporting){const cols=['booking_number','contact_name','contact_phone','contact_email','created_at','occasion','event_date','guest_count','package_name','services_json','total_amount','discount_amount','referral_code','partner_user_id','booking_status','payment_status','assigned_name','last_follow_up_at','notes'];return new Response('\uFEFF'+[cols.join(','),...bookings.map((b:any)=>cols.map(c=>csvCell(typeof b[c]==='object'?JSON.stringify(b[c]):b[c])).join(','))].join('\r\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="hala-bookings.csv"','cache-control':'no-store'}});}
   const total=Number((await client.query(`SELECT count(*)::int count FROM bookings b WHERE ${where}`,args)).rows[0].count);
   const notifications=(await client.query('SELECT n.*,b.booking_number FROM booking_notifications n JOIN bookings b ON b.id=n.booking_id WHERE b.environment=$1 ORDER BY n.created_at DESC LIMIT 100',[environment])).rows;
   const staff=(await client.query("SELECT id,name FROM users WHERE role IN ('admin','customer_service') AND status='active' ORDER BY name")).rows;
   const summary=(await client.query(`SELECT count(*)::int count,COALESCE(sum(total_amount),0)::bigint value,COALESCE(sum(total_amount) FILTER(WHERE payment_status='paid'),0)::bigint paid_value FROM bookings b WHERE ${where}`,args)).rows[0];
   return secureJson({bookings,notifications,total,page,pageSize:50,staff,summary});
  }
  const body:any=await req.json(),allowed=new Set(['id','bookingStatus','assignedUserId','notes','followupStatus','nextFollowUpAt','entryStatus','organizerIds']);
  if(Object.keys(body).some(k=>!allowed.has(k)))throw bookingError('لا يمكن تعديل الدفع أو حقول الأسعار من لوحة المتابعة');
  if(body.bookingStatus!==undefined&&(!statuses.includes(body.bookingStatus)||body.bookingStatus==='confirmed'))throw bookingError('التأكيد النهائي يتطلب سدادًا مثبتًا من الخادم');
  if(body.followupStatus!==undefined&&!['new','contacted','follow_up','closed'].includes(body.followupStatus))throw bookingError('حالة المتابعة غير صالحة');
  if(body.notes!==undefined&&(typeof body.notes!=='string'||body.notes.length>4000))throw bookingError('الملاحظة أطول من المسموح');
  if(body.nextFollowUpAt&&!Number.isFinite(Date.parse(body.nextFollowUpAt)))throw bookingError('موعد المتابعة غير صالح');
  client=await db.pool.connect();await client.query('BEGIN');
  const row=(await client.query('SELECT * FROM bookings WHERE id=$1 AND environment=$2 FOR UPDATE',[body.id,environment])).rows[0];
  if(!row)throw bookingError('الحجز غير موجود',404);
  if(body.assignedUserId){const person=(await client.query("SELECT id FROM users WHERE id=$1 AND role IN ('admin','customer_service') AND status='active'",[body.assignedUserId])).rows[0];if(!person)throw bookingError('الموظف غير متاح');}
  if(body.bookingStatus==='completed'&&row.payment_status!=='paid')throw bookingError('إكمال الحجز يتطلب سدادًا مثبتًا',409);
  if(row.payment_status==='paid'&&body.bookingStatus&&body.bookingStatus!=='completed'&&body.bookingStatus!==row.booking_status)throw bookingError('الحجز المدفوع يتطلب إجراء إدارة منفصلًا',409);
  const updated=(await client.query('UPDATE bookings SET booking_status=$1,assigned_user_id=$2,notes=$3,followup_status=$4,next_follow_up_at=$5,last_follow_up_at=NOW(),updated_at=NOW() WHERE id=$6 RETURNING *',[body.bookingStatus??row.booking_status,body.assignedUserId===undefined?row.assigned_user_id:body.assignedUserId||null,body.notes??row.notes,body.followupStatus??row.followup_status,body.nextFollowUpAt===undefined?row.next_follow_up_at:body.nextFollowUpAt||null,row.id])).rows[0];
  if(body.entryStatus!==undefined||body.organizerIds!==undefined){
   if(auth.user.role!=='admin')throw bookingError('تعديل تنظيم الدخول متاح للإدارة فقط',403);
   if(!['pending_review','available','unavailable','assigned','completed'].includes(body.entryStatus||row.entry_status)||row.entry_status==='not_requested')throw bookingError('حالة تنظيم الدخول غير صالحة');
   const ids=body.organizerIds??row.organizer_ids;
   const entry=row.services_json.find((s:any)=>s.id==='supervisor');
   if(!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length||ids.some((id:any)=>typeof id!=='string'))throw bookingError('اختر منظمين مختلفين');
   const target=body.entryStatus||row.entry_status;
   if(target==='assigned'&&(ids.length!==entry?.organizers||row.payment_status!=='paid'))throw bookingError('يلزم السداد وتعيين العدد المطلوب كاملًا');
   for(const id of ids){if(!(await client.query("SELECT id FROM users WHERE id=$1 AND role='supervisor' AND status='active'",[id])).rows[0])throw bookingError('المنظم غير متاح');}
   for(const previousId of row.organizer_ids||[])if(target!=='assigned'||!ids.includes(previousId))await client.query("DELETE FROM event_members WHERE event_id=$1 AND user_id=$2 AND member_role='supervisor'",[row.event_id,previousId]);
   await client.query('UPDATE bookings SET entry_status=$1,organizer_ids=$2::jsonb WHERE id=$3',[target,JSON.stringify(ids),row.id]);
   if(target==='assigned')for(const id of ids)await client.query("INSERT INTO event_members(event_id,user_id,member_role) VALUES($1,$2,'supervisor') ON CONFLICT(event_id,user_id) DO UPDATE SET member_role='supervisor'",[row.event_id,id]);
   Object.assign(updated,{entry_status:target,organizer_ids:ids});
  }
  await auditBooking(client,auth.user.id,'booking.followup_updated',row.id,{previousStatus:row.booking_status,status:updated.booking_status,assignedUserId:updated.assigned_user_id,changedFields:Object.keys(body).filter(k=>k!=='id')});
  await client.query("UPDATE booking_notifications SET read_at=NOW() WHERE booking_id=$1 AND kind='internal'",[row.id]);
  await client.query('COMMIT');
  const {access_token_hash,request_hash,idempotency_key,...safe}=updated;return secureJson({booking:safe});
 }catch(e:any){if(client)await client.query('ROLLBACK').catch(()=>undefined);return secureJson({error:e.status?e.message:'تعذر إدارة الحجوزات'},e.status||500);}
 finally{if(client)client.release();}
};
export const config:Config={path:'/api/admin/bookings'};
