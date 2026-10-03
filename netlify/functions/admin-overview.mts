import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { requireRole } from "./_shared/auth.mjs";
import { secureJson } from "./_shared/domain.mjs";

export default async(req:Request)=>{
  if(req.method!=="GET")return new Response("Method Not Allowed",{status:405});
  const auth=await requireRole(req,["admin"]);if(!auth.ok)return secureJson({error:auth.error},auth.status);
  try{
    const db=getDatabase();
    const [
      visits,visitsToday,unique7,users,supervisors,events,eventsToday,guests,accepted,checkedIn,
      wa,revenue,supervisorStats,inviteViews,recentOps,recentEvents,recentPayments
    ]=await Promise.all([
      db.sql`SELECT COUNT(*)::int count FROM page_views WHERE event_name='page_view'`,
      db.sql`SELECT COUNT(*)::int count FROM page_views WHERE event_name='page_view' AND created_at>=date_trunc('day',NOW())`,
      db.sql`SELECT COUNT(DISTINCT session_id)::int count FROM page_views WHERE created_at>NOW()-INTERVAL '7 days'`,
      db.sql`SELECT COUNT(*)::int count FROM users WHERE role='customer'`,
      db.sql`SELECT COUNT(*)::int count FROM users WHERE role='supervisor'`,
      db.sql`SELECT COUNT(*)::int count FROM events`,
      db.sql`SELECT COUNT(*)::int count FROM events WHERE created_at>=date_trunc('day',NOW())`,
      db.sql`SELECT COUNT(*)::int count FROM guests`,
      db.sql`SELECT COUNT(*)::int count FROM guests WHERE rsvp_status='accepted'`,
      db.sql`SELECT COUNT(*)::int count FROM guests WHERE checked_in_at IS NOT NULL`,
      db.sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='sent')::int sent,COUNT(*) FILTER(WHERE status='delivered')::int delivered,COUNT(*) FILTER(WHERE status='read')::int read,COUNT(*) FILTER(WHERE status='failed')::int failed FROM whatsapp_messages`,
      db.sql`SELECT COALESCE(SUM(amount+supervisor_addon_amount) FILTER(WHERE status='paid'),0)::bigint revenue,COUNT(*) FILTER(WHERE status='paid')::int paid FROM payment_orders`,
      db.sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='requested')::int requested,COUNT(*) FILTER(WHERE status='assigned')::int assigned,COUNT(*) FILTER(WHERE status='completed')::int completed FROM supervisor_requests`,
      db.sql`SELECT COUNT(*)::int count FROM guests WHERE viewed_at IS NOT NULL`,
      db.sql`SELECT a.action,a.entity_type,a.entity_id,a.metadata,a.created_at,u.name actor_name,u.role actor_role FROM audit_log a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 80`,
      db.sql`SELECT id,title,occasion,city,event_date,created_at FROM events ORDER BY created_at DESC LIMIT 12`,
      db.sql`SELECT p.id,p.event_id,p.amount,p.supervisor_addon_amount,p.currency,p.status,p.payment_method,p.created_at,p.paid_at,u.name customer_name,u.phone customer_phone FROM payment_orders p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 12`
    ]);
    return secureJson({
      stats:{
        visits:Number(visits[0]?.count||0),visitsToday:Number(visitsToday[0]?.count||0),uniqueVisitors7d:Number(unique7[0]?.count||0),
        customers:Number(users[0]?.count||0),supervisors:Number(supervisors[0]?.count||0),events:Number(events[0]?.count||0),eventsToday:Number(eventsToday[0]?.count||0),
        guests:Number(guests[0]?.count||0),accepted:Number(accepted[0]?.count||0),checkedIn:Number(checkedIn[0]?.count||0),inviteViews:Number(inviteViews[0]?.count||0),
        whatsapp:wa[0]||{},revenueHalalas:Number(revenue[0]?.revenue||0),paidOrders:Number(revenue[0]?.paid||0),supervisorRequests:supervisorStats[0]||{}
      },
      recentOps,recentEvents,recentPayments
    });
  }catch(error){console.error(error);return secureJson({error:"تعذر تحميل لوحة الإدارة"},500)}
};
export const config:Config={path:"/api/admin/overview"};