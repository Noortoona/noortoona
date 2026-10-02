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
