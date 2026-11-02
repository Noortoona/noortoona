// Cloud API is intentionally independent of the 360dialog transport.
export function metaBookingConfig(env, recipient, context) {
  if (env('HALA_BOOKING_WA_PROVIDER') !== 'meta') return null;
  const version = env('META_WA_GRAPH_VERSION');
  const sender = (env('META_WA_SENDER_PHONE') || '').replace(/\D/g, '');
  const phoneId = env('META_WA_PHONE_NUMBER_ID');
  const template = env('META_WA_BOOKING_TEMPLATE');
  if (env('HALA_BOOKING_NOTIFICATIONS_ENABLED') !== 'true' ||
      env('HALA_BOOKING_NOTIFICATION_RECIPIENT_CONFIRMED') !== 'true' ||
      env('META_WA_BOOKING_TEMPLATE_APPROVED') !== 'true' ||
      !/^v\d+\.\d+$/.test(version) || !/^\d{5,30}$/.test(phoneId) ||
      !/^[a-z][a-z0-9_]{0,511}$/.test(template) ||
      !env('META_WA_ACCESS_TOKEN') || !env('META_WA_APP_SECRET') ||
      !env('META_WA_VERIFY_TOKEN') || sender !== '966510654663' ||
      !/^9665\d{8}$/.test(recipient) || sender === recipient ||
      !(context === 'production' || context === 'deploy-preview' && env('HALA_BOOKING_NOTIFICATIONS_PREVIEW') === 'true')) return null;
  return { apiBase: `https://graph.facebook.com/${version}/${phoneId}`, phoneId, template, token: env('META_WA_ACCESS_TOKEN') };
}

export async function verifyMetaSignature(body, signature, secret) {
  if (!secret || !/^sha256=[0-9a-f]{64}$/.test(signature || '')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const supplied = Uint8Array.from(signature.slice(7).match(/../g), byte => parseInt(byte, 16));
  let different = 0;
  for (let i = 0; i < digest.length; i++) different |= digest[i] ^ supplied[i];
  return different === 0;
}

export function metaStatuses(payload, phoneId) {
  if (payload?.object !== 'whatsapp_business_account') return [];
  return (Array.isArray(payload.entry) ? payload.entry : []).flatMap(entry =>
    (Array.isArray(entry.changes) ? entry.changes : []).flatMap(change =>
      change.field === 'messages' && String(change.value?.metadata?.phone_number_id) === phoneId
        ? (Array.isArray(change.value?.statuses) ? change.value.statuses : [])
        : []));
}
