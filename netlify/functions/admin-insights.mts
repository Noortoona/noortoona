import type {Config} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {requireRole} from './_shared/auth.mjs';
import {secureJson} from './_shared/domain.mjs';
import {analyticsEnvironment} from './_shared/analytics.mjs';
const number=(x:any)=>Number(x||0);
const percent=(a:any,b:any)=>Number(b)>0?Math.round(Number(a)/Number(b)*10000)/100:0;
export default async(req:Request)=>{
 if(req.method!=='GET')return new Response('Method Not Allowed',{status:405});
 const auth=await requireRole(req,['admin','customer_service']);if(!auth.ok)return secureJson({error:auth.error},auth.status);
 try{
 const db=getDatabase(),environment=analyticsEnvironment();
 const [traffic,legacy,topPages,sources,devices,funnel,interest,leadCount,bookingRows,revenue,knownConversion,legacyPayments]=await Promise.all([
  db.sql`SELECT COUNT(*) FILTER(WHERE event_name='page_view')::int total,COUNT(*) FILTER(WHERE event_name='page_view' AND created_at>=(date_trunc('day',NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh'))::int today,COUNT(*) FILTER(WHERE event_name='page_view' AND created_at>=NOW()-INTERVAL '7 days')::int seven_days,COUNT(*) FILTER(WHERE event_name='page_view' AND created_at>=NOW()-INTERVAL '30 days')::int thirty_days,COUNT(DISTINCT session_id) FILTER(WHERE event_name='page_view')::int sessions,COUNT(DISTINCT visitor_id) FILTER(WHERE event_name='page_view')::int estimated_visitors,COUNT(DISTINCT session_id) FILTER(WHERE event_name='page_view' AND visitor_id IS NULL)::int unidentified_sessions FROM page_views WHERE environment=${environment}`,
  db.sql`SELECT COUNT(*) FILTER(WHERE event_name='page_view')::int page_views,COUNT(DISTINCT session_id)::int session_identifiers FROM page_views WHERE environment='legacy_unclassified'`,
  db.sql`SELECT path,COUNT(*)::int count FROM page_views WHERE environment=${environment} AND event_name='page_view' GROUP BY path ORDER BY count DESC,path LIMIT 20`,
  db.sql`SELECT COALESCE(source->>'source','direct_or_unknown') source,COUNT(*)::int count FROM page_views WHERE environment=${environment} AND event_name='page_view' GROUP BY source->>'source' ORDER BY count DESC LIMIT 20`,
  db.sql`SELECT device_type,COUNT(*)::int count FROM page_views WHERE environment=${environment} AND event_name='page_view' GROUP BY device_type ORDER BY count DESC`,
  db.sql`SELECT event_name,COUNT(DISTINCT session_id)::int sessions,COUNT(*)::int count FROM page_views WHERE environment=${environment} GROUP BY event_name ORDER BY event_name`,
  db.sql`SELECT event_name,COUNT(*)::int count FROM page_views WHERE environment=${environment} AND event_name<>'page_view' GROUP BY event_name ORDER BY count DESC,event_name`,
  db.sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE kind<>'pre_booking')::int interested,COUNT(*) FILTER(WHERE marketing_consent=true)::int marketing_opted_in FROM leads WHERE environment=${environment}`,
  db.sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE created_at>=(date_trunc('day',NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh'))::int today,COUNT(*) FILTER(WHERE booking_status='pre_booking_received')::int pre_bookings,COUNT(*) FILTER(WHERE payment_status='pending_payment' AND booking_status<>'cancelled')::int pending_payment,COUNT(*) FILTER(WHERE payment_status='paid' AND booking_status<>'cancelled')::int paid,COUNT(*) FILTER(WHERE booking_status='cancelled')::int cancelled,COALESCE(SUM(total_amount) FILTER(WHERE payment_status='pending_payment' AND booking_status<>'cancelled'),0)::bigint potential_value,COALESCE(AVG(total_amount),0)::bigint average_order FROM bookings WHERE environment=${environment}`,
  db.sql`SELECT COALESCE(SUM(amount),0)::bigint amount,COUNT(*)::int count FROM payment_orders WHERE environment=${environment} AND payment_mode='live' AND status='paid'`,
  db.sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.environment=${environment} AND ((l.phone IS NOT NULL AND b.contact_phone=l.phone) OR (l.email IS NOT NULL AND lower(b.contact_email)=lower(l.email)))))::int booked FROM leads l WHERE l.environment=${environment} AND l.kind<>'pre_booking'`,
  db.sql`SELECT COUNT(*) FILTER(WHERE status='paid')::int count,COALESCE(SUM(amount) FILTER(WHERE status='paid'),0)::bigint amount FROM payment_orders WHERE environment='legacy_unclassified' OR payment_mode='unknown'`
 ]);
 const v=traffic[0]||{},b=bookingRows[0]||{},known=knownConversion[0]||{},events=Object.fromEntries(funnel.map((row:any)=>[row.event_name,number(row.sessions)]));
 // Funnel is a session cohort: completion must belong to a recorded start in
 // the same environment, so an unrelated completion never inflates the rate.
 const [startedVisitors,completedStarts]=await Promise.all([
  db.sql`SELECT COUNT(DISTINCT p.session_id)::int count FROM page_views p WHERE p.environment=${environment} AND p.event_name='page_view' AND EXISTS(SELECT 1 FROM page_views s WHERE s.environment=${environment} AND s.session_id=p.session_id AND s.event_name='booking_started')`,
  db.sql`SELECT COUNT(DISTINCT s.session_id)::int count FROM page_views s WHERE s.environment=${environment} AND s.event_name='booking_started' AND EXISTS(SELECT 1 FROM page_views c WHERE c.environment=${environment} AND c.session_id=s.session_id AND c.event_name='prebooking_completed' AND c.created_at>=s.created_at)`
 ]);
 return secureJson({
  scope:{environment,timezone:'Asia/Riyadh',tracking:'consented_observed_traffic',visitorEstimateNote:'معرّفات متصفح بموافقة المستخدم؛ ليست عدد أشخاص مؤكدًا. الزيارات غير الموافق على قياسها غير مشمولة.',legacyUnclassified:{pageViews:number(legacy[0]?.page_views),sessionIdentifiers:number(legacy[0]?.session_identifiers),paidOrders:number(legacyPayments[0]?.count),paidAmountHalalas:number(legacyPayments[0]?.amount),includedInCurrentMetrics:false}},
  visits:{total:number(v.total),pageViews:number(v.total),today:number(v.today),sevenDays:number(v.seven_days),thirtyDays:number(v.thirty_days),sessions:number(v.sessions),estimatedVisitors:number(v.estimated_visitors),unidentifiedSessions:number(v.unidentified_sessions),topPages,sources,devices},
  interests:{events:interest.reduce((n:number,row:any)=>n+number(row.count),0),knownLeads:number(leadCount[0]?.interested),knownContacts:number(leadCount[0]?.total),marketingOptedIn:number(leadCount[0]?.marketing_opted_in),byEvent:interest,contactVerification:'بيانات تواصل أدخلها أصحاب الطلبات؛ ليست موثقة برمز OTP إلا للحسابات الموثقة'},
  bookings:{total:number(b.total),today:number(b.today),preBookings:number(b.pre_bookings),pendingPayment:number(b.pending_payment),paid:number(b.paid),cancelled:number(b.cancelled),potentialValueHalalas:number(b.potential_value),realizedRevenueHalalas:number(revenue[0]?.amount),paidTransactions:number(revenue[0]?.count),averageOrderHalalas:number(b.average_order)},
  conversion:{visitToBookingStartPercent:percent(startedVisitors[0]?.count,v.sessions),bookingCompletionPercent:percent(completedStarts[0]?.count,events.booking_started),knownLeadToBookingPercent:percent(known.booked,known.total),prebookingToPaidPercent:percent(b.paid,b.total)},funnel,
  metricSources:{visits:'page_views: environment scoped; page_view rows; Saudi day boundaries',sessions:'Distinct session_id among page_view rows (30 minute idle client session)',estimatedVisitors:'Distinct opted-in visitor_id among page_view rows; browser identifiers, not people',interests:'Non-page_view rows; server validates completion/contact registrations',knownLeads:'leads submitted contact rows with kind launch/contact; unverified contact unless OTP account',bookings:'bookings persisted rows; no browser success event used as a booking',potentialValue:'SUM bookings.total_amount WHERE pending_payment and not cancelled; halalas',realizedRevenue:'SUM payment_orders.amount WHERE status paid, payment_mode live, environment matches; test/unknown excluded',visitToBookingStart:'Sessions with both page_view and booking_started / page_view sessions',bookingCompletion:'Started sessions with subsequent server-recorded completion / started sessions',knownLeadToBooking:'Known contact rows with a linked matching booking / known contact rows',prebookingToPaid:'Paid booking rows / all persisted bookings',legacy:'Retained historical events without verifiable environment or payment mode are reported separately, never silently counted as production'}
 });
 }catch{console.error('Insights query failed');return secureJson({error:'تعذر تحميل الإحصائيات الحقيقية'},500)}
};
export const config:Config={path:'/api/admin/insights'};
