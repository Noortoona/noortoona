import type { Config } from '@netlify/functions';
import { getDatabase } from '@netlify/database';
import { requireRole, recordAudit } from './_shared/auth.mjs';
import { isSameOriginRequest, secureJson } from './_shared/domain.mjs';
import { providerConfig, officialWhatsApp, maskPhone } from './_shared/whatsapp.mjs';
import { analyticsEnvironment } from './_shared/analytics.mjs';

// Read-only provider diagnostics. No webhook registration or account changes here.
async function providerDiagnostics(get: (key: string) => string) {
  let cfg;
  try { cfg = providerConfig(get); }
  catch (error) { return { status: 'not_configured', code: (error as Error).message }; }
  if (cfg.mode !== 'production') return { status: 'sandbox', productionVerified: false };
  const read = async (path: string) => {
    try {
      const response = await fetch(`${cfg.apiBase}${path}`, { headers: { 'D360-API-KEY': get('D360_API_KEY') }, signal: AbortSignal.timeout(8000) });
      const data = response.ok ? await response.json() : null;
      return { ok: response.ok, httpStatus: response.status, data };
    } catch { return { ok: false, httpStatus: null, data: null }; }
  };
  const [webhook, templates] = await Promise.all([read('/v1/configs/webhook'), read('/message_templates?limit=100')]);
  const configured = webhook.data?.url || webhook.data?.data?.url || null;
  let webhookOrigin = null;
  try { webhookOrigin = new URL(configured).origin + new URL(configured).pathname; } catch {}
  return {
    status: webhook.ok || templates.ok ? 'api_authenticated' : 'unverified',
    // API authentication does not establish sender identity, WABA ownership or delivery.
    productionVerified: false,
    webhook: { httpStatus: webhook.httpStatus, url: webhookOrigin },
    templates: { httpStatus: templates.httpStatus, firstPageOnly: true,
      items: (Array.isArray(templates.data?.data) ? templates.data.data : []).slice(0,100).map((t: any) => ({
        name: String(t.name || '').slice(0,100), language: String(t.language || '').slice(0,20),
        status: String(t.status || '').slice(0,40), category: String(t.category || '').slice(0,40)
      })) }
  };
}

export default async (req: Request) => {
  if (!['GET','POST'].includes(req.method)) return new Response('Method Not Allowed', { status: 405 });
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return secureJson({ error: auth.error }, auth.status);
  if (!isSameOriginRequest(req)) return secureJson({ error: 'طلب غير مسموح' }, 403);
  const db = getDatabase();
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.action !== 'resolve' || typeof body.messageId !== 'string' || body.messageId.length > 512) return secureJson({ error: 'طلب غير صالح' }, 400);
      const rows = await db.sql`UPDATE whatsapp_inbox SET resolved_at=NOW(),resolved_by=${auth.user.id} WHERE message_id=${body.messageId} AND resolved_at IS NULL RETURNING message_id`;
      await recordAudit(auth.user.id, 'whatsapp.inbox_resolved', 'whatsapp', body.messageId);
      return secureJson({ updated: rows.length === 1 });
    }
    const [state, inbox, invitations, otp, bookings] = await Promise.all([
      db.sql`SELECT last_received_at,observed_phone FROM whatsapp_webhook_state WHERE id=1`,
      db.sql`SELECT message_id,sender_phone,message_type,body,received_at,resolved_at FROM whatsapp_inbox ORDER BY received_at DESC LIMIT 50`,
      db.sql`SELECT id,message_id,event_id,guest_id,kind,status,error,created_at FROM whatsapp_messages ORDER BY created_at DESC LIMIT 50`,
      // Deliberately exclude OTP hashes, codes and response payloads.
      db.sql`SELECT id,phone,message_id,delivery_status,sent_at FROM otp_codes ORDER BY sent_at DESC LIMIT 50`,
      db.sql`SELECT n.id,n.booking_id,n.event_name,n.status,n.message_id,n.error_code,n.updated_at FROM booking_notifications n JOIN bookings b ON b.id=n.booking_id WHERE b.environment=${analyticsEnvironment()} ORDER BY n.updated_at DESC LIMIT 50`
    ]);
    const get = (key: string) => String(Netlify.env.get(key) || '');
    const required = ['D360_MODE','D360_API_KEY','D360_WEBHOOK_TOKEN','D360_INVITE_TEMPLATE','D360_TEMPLATE_LANGUAGE','D360_OTP_TEMPLATE','HALA_OTP_SECRET','D360_SENDER_PHONE'];
    const diagnostics = new URL(req.url).searchParams.get('probe') === 'true' ? await providerDiagnostics(get) : null;
    return secureJson({ official: officialWhatsApp, mode: get('D360_MODE') || 'unset',
      meta: { status: 'unverified', displayNameStatus: 'unverified', wabaStatus: 'unverified' },
      sender: { configuredPhone: get('D360_SENDER_PHONE'), observedPhone: state[0]?.observed_phone || null, ownershipVerified: false },
      configuration: required.map(key => ({ key, present: !!get(key) })),
      webhook: { protected: !!get('D360_WEBHOOK_TOKEN'), lastReceivedAt: state[0]?.last_received_at || null },
      diagnostics, inbox: inbox.map(row => ({ ...row, sender_phone: maskPhone(row.sender_phone) })),
      invitations, otp: otp.map(row => ({ ...row, phone: maskPhone(row.phone) })), bookings,
      notifications: { enabled: get('HALA_BOOKING_NOTIFICATIONS_ENABLED') === 'true', templateConfigured: !!get('D360_BOOKING_TEMPLATE'), recipientConfirmed: get('HALA_BOOKING_NOTIFICATION_RECIPIENT_CONFIRMED') === 'true' }
    });
  } catch {
    return secureJson({ error: 'تعذر قراءة سجلات واتساب. تحقق من تطبيق ترحيل قاعدة البيانات وإعدادات الاتصال.', code: 'WHATSAPP_MANAGEMENT_UNAVAILABLE' }, 503);
  }
};

export const config: Config = { path: '/api/admin/whatsapp' };
