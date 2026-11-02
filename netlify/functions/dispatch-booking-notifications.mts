import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { notificationChannelReady, sendBookingEmail, sendBookingWhatsApp } from "./_shared/booking-notify.mjs";

// These are durable outbox jobs. Do not retry uncertain sends automatically;
// provider acceptance can occur even when the connection times out.
export default async () => {
  const db = getDatabase();
  for (const channel of ["email","whatsapp"]) {
    if (!notificationChannelReady(channel)) continue;
    const client = await db.pool.connect();
    let reserved: any[] = [];
    try {
      await client.query("BEGIN");
      const batch = await client.query(`
        SELECT n.id,b.booking_code,b.amount,b.package_name,b.referral_code,
          e.title,e.event_date,u.name AS customer_name,u.phone AS customer_phone
        FROM booking_notifications n
        JOIN booking_requests b ON b.id=n.booking_id
        JOIN events e ON e.id=b.event_id
        JOIN users u ON u.id=b.customer_user_id
        WHERE n.channel=$1 AND n.status='queued'
        ORDER BY n.created_at,n.id
        FOR UPDATE OF n SKIP LOCKED
        LIMIT 5
      `, [channel]);
      reserved = batch.rows;
      for (const item of reserved) {
        await client.query("UPDATE booking_notifications SET status='processing',attempts=attempts+1,updated_at=NOW() WHERE id=$1", [item.id]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("BOOKING_OUTBOX_RESERVE_ERROR",channel);
      continue;
    } finally { client.release(); }

    for (const item of reserved) {
      let status = "uncertain", messageId: string | null = null, errorCode: string | null = null;
      try {
        messageId = channel==="email" ? await sendBookingEmail(item) : await sendBookingWhatsApp(item);
        status="accepted"; // confirmed by provider, not yet delivered
      } catch (error) {
        const code = String((error as Error)?.message || "PROVIDER_UNKNOWN").slice(0,80);
        const explicit = /^(ZOHO_AUTH_REJECTED|ZOHO_MESSAGE_REJECTED|D360_REJECTED_)/.test(code);
        status = explicit ? "failed" : "uncertain";
        errorCode = code.startsWith("D360_") || code.startsWith("ZOHO_") ? code : "TRANSPORT_UNCERTAIN";
        console.error("BOOKING_NOTIFICATION_ERROR",channel,errorCode);
      }
      try {
        await db.sql`
          UPDATE booking_notifications SET status=${status},
            provider_message_id=${messageId},last_error=${errorCode},updated_at=NOW()
          WHERE id=${item.id} AND status='processing'
        `;
      } catch {
        // Keep 'processing' for manual reconciliation, never blindly retry.
        console.error("BOOKING_OUTBOX_UPDATE_ERROR",channel);
      }
    }
  }
  return new Response(null,{status:204});
};

// Preview/branch deploys will not automatically run this; invoke manually there.
export const config: Config = { schedule: "*/5 * * * *" };
