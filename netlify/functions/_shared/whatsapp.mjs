// No credentials or recipient data may be included in diagnostic errors.
export function providerError(payload) {
  const raw = payload?.errors?.[0] || payload?.error || payload;
  return {
    code: String(raw?.code || raw?.error_code || 'D360_SEND_FAILED').slice(0, 80),
    message: String(raw?.title || raw?.message || (typeof raw === 'string' ? raw : '') || 'رفض مزود واتساب الطلب').slice(0, 300),
  };
}

export function extractStatuses(payload) {
  if (Array.isArray(payload?.statuses)) return payload.statuses;
  return (Array.isArray(payload?.entry) ? payload.entry : []).flatMap(entry =>
    (Array.isArray(entry?.changes) ? entry.changes : []).flatMap(change =>
      Array.isArray(change?.value?.statuses) ? change.value.statuses : []));
}

// Keep only the fields required by the support inbox; never persist raw payloads/media.
export function extractIncoming(payload) {
  const values = Array.isArray(payload?.messages) ? [payload] :
    (Array.isArray(payload?.entry) ? payload.entry : []).flatMap(entry =>
      (Array.isArray(entry?.changes) ? entry.changes : []).map(change => change?.value).filter(Boolean));
  return values.flatMap(value => (Array.isArray(value.messages) ? value.messages : []).flatMap(message => {
    const sender = String(message?.from || '').replace(/\D/g, '');
    if (typeof message?.id !== 'string' || !message.id || message.id.length > 512 || !/^[1-9]\d{7,14}$/.test(sender)) return [];
    const seconds = Number(message.timestamp);
    const providerAt = Number.isFinite(seconds) && seconds > 0 && seconds <= Date.now()/1000 + 300 ? new Date(seconds*1000).toISOString() : null;
    const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
    return [{ id: message.id, sender, recipient: String(value.metadata?.display_phone_number || '').replace(/\D/g, '').slice(0, 15),
      type: String(message.type || 'unknown').slice(0, 40),
      body: String(text).replace(/(?<!\d)\d{6}(?!\d)/g, '[رمز محجوب]').slice(0, 4000), providerAt }];
  }));
}

export const officialWhatsApp = { phone: '966510654663', displayName: 'HALA | هلا', url: 'https://wa.me/966510654663' };

export function maskPhone(phone) {
  const value = String(phone || '');
  return value.length > 4 ? '*'.repeat(value.length - 4) + value.slice(-4) : '****';
}

export function nextStatus(current, incoming) {
  const rank = { queued: 0, sent: 1, delivered: 2, read: 3 };
  if (!['sent', 'delivered', 'read', 'failed'].includes(incoming)) return current;
  if (incoming === 'failed') return ['delivered', 'read'].includes(current) ? current : 'failed';
  if (current === 'failed') return ['delivered', 'read'].includes(incoming) ? incoming : current;
  return (rank[incoming] ?? -1) > (rank[current] ?? -1) ? incoming : current;
}

export function providerConfig(env) {
  const mode = (env('D360_MODE') || '').toLowerCase();
  if (!['production', 'sandbox'].includes(mode)) throw new Error('D360_MODE_REQUIRED');
  const expectedBase = mode === 'production' ? 'https://waba-v2.360dialog.io' : 'https://waba-sandbox.360dialog.io/v1';
  const apiBase = (env('D360_API_BASE') || expectedBase).replace(/\/$/, '');
  if (apiBase !== expectedBase) throw new Error('D360_API_BASE_MISMATCH');
  if (!env('D360_API_KEY')) throw new Error('D360_NOT_CONFIGURED');
  return { mode, apiBase };
}
