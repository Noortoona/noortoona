import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {requireRole} from './_shared/auth.mjs';
import {isSameOriginRequest,secureJson} from './_shared/domain.mjs';
import {analyticsEnvironment} from './_shared/analytics.mjs';
export default async(req:Request)=>{
 const auth=await requireRole(req,['admin','customer_service']);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 const db=getDatabase(),environment=analyticsEnvironment();
 if(req.method==='GET'){
  try{const url=new URL(req.url),q=(url.searchParams.get('q')||'').trim().slice(0,120),status=(url.searchParams.get('status')||'').slice(0,40),page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1));
   const leads=await db.sql`SELECT l.*,u.name assigned_user_name,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',b.id,'booking_number',b.booking_number,'booking_status',b.booking_status,'payment_status',b.payment_status)) FROM bookings b WHERE b.environment=${environment} AND ((l.phone IS NOT NULL AND b.contact_phone=l.phone) OR (l.email IS NOT NULL AND lower(b.contact_email)=lower(l.email)))),'[]'::jsonb) bookings FROM leads l LEFT JOIN users u ON u.id=l.assigned_user_id WHERE l.environment=${environment} AND (${q}='' OR l.name ILIKE ${'%'+q+'%'} OR l.phone ILIKE ${'%'+q+'%'} OR l.email ILIKE ${'%'+q+'%'}) AND (${status}='' OR l.contact_status=${status}) ORDER BY l.created_at DESC LIMIT 100 OFFSET ${(page-1)*100}`;
   const count=await db.sql`SELECT COUNT(*)::int count FROM leads WHERE environment=${environment}`;return secureJson({leads,total:count[0].count,page,contactVerification:'submitted_contact_not_OTP_verified'});
  }catch{return secureJson({error:'تعذر تحميل العملاء'},500)}
 }
 if(req.method!=='PATCH')return new Response('Method Not Allowed',{status:405});if(!isSameOriginRequest(req))return secureJson({error:'طلب غير مسموح'},403);
 let client:any;try{const b:any=await req.json(),allowed=['id','assignedUserId','notes','contactStatus','nextFollowUpAt'];if(Object.keys(b).some(k=>!allowed.includes(k))||!b.id)return secureJson({error:'حقول غير مسموحة'},400);
 if(b.contactStatus!==undefined&&!['new','contacted','awaiting_response','follow_up','converted','closed'].includes(b.contactStatus))return secureJson({error:'حالة تواصل غير صالحة'},400);
 if(b.notes!==undefined&&(typeof b.notes!=='string'||b.notes.length>4000))return secureJson({error:'الملاحظات غير صالحة'},400);
 const next=b.nextFollowUpAt?new Date(b.nextFollowUpAt):null;if(next&&Number.isNaN(next.getTime()))return secureJson({error:'موعد متابعة غير صالح'},400);
 client=await db.pool.connect();await client.query('BEGIN');const lead=(await client.query('SELECT * FROM leads WHERE id=$1 AND environment=$2 FOR UPDATE',[String(b.id),environment])).rows[0];
 if(!lead){await client.query('ROLLBACK');return secureJson({error:'العميل غير موجود'},404);}
 let assigned=b.assignedUserId===undefined?lead.assigned_user_id:b.assignedUserId||null;
 if(assigned&&!(await client.query("SELECT id FROM users WHERE id=$1 AND status='active' AND role IN ('admin','customer_service')",[assigned])).rows[0]){await client.query('ROLLBACK');return secureJson({error:'اختر موظفة أو موظفًا مخوّلًا'},400);}
 const updated=(await client.query('UPDATE leads SET assigned_user_id=$1,notes=$2,contact_status=$3,next_follow_up_at=$4,last_follow_up_at=NOW(),updated_at=NOW() WHERE id=$5 RETURNING *',[assigned,b.notes===undefined?lead.notes:b.notes,b.contactStatus===undefined?lead.contact_status:b.contactStatus,b.nextFollowUpAt===undefined?lead.next_follow_up_at:next?.toISOString()||null,lead.id])).rows[0];
 await client.query("INSERT INTO audit_log(id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'lead.follow_up','lead',$3,$4::jsonb)",[crypto.randomUUID(),auth.user.id,lead.id,JSON.stringify({before:{contactStatus:lead.contact_status,assignedUserId:lead.assigned_user_id},after:{contactStatus:updated.contact_status,assignedUserId:updated.assigned_user_id},notesChanged:b.notes!==undefined})]);await client.query('COMMIT');return secureJson({lead:updated});
 }catch{if(client)await client.query('ROLLBACK').catch(()=>{});return secureJson({error:'تعذر حفظ المتابعة'},500)}finally{if(client)client.release()}
};
export const config:Config={path:'/api/admin/leads'};
