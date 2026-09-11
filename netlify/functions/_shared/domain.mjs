export function boundedInteger(value, min = 0, max = 20) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function boundedMoney(value, max = 1_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(max, Math.round(parsed * 100) / 100));
}

export function partySize(companions = 0, children = 0) {
  return 1 + boundedInteger(companions) + boundedInteger(children);
}

export function calculateShareTotal(shareAmount, companions = 0, accepted = true) {
  if (!accepted) return 0;
  return boundedMoney(boundedMoney(shareAmount) * (1 + boundedInteger(companions)));
}

export function decideAttendance({ used = 0, capacity = 0, requested = 1, waitlistEnabled = false }) {
  const limit = boundedInteger(capacity, 0, 500);
  if (!limit || boundedInteger(used, 0, 100_000) + boundedInteger(requested, 1, 41) <= limit) return "normal";
  return waitlistEnabled ? "waitlist" : "full";
}

export function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");
  if (value.startsWith("00")) value = value.slice(2);
  if (value.startsWith("0") && value.length === 10) value = `966${value.slice(1)}`;
  if (value.length === 9 && value.startsWith("5")) value = `966${value}`;
  return value.slice(0, 20);
}

export function isSameOriginRequest(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export function ownerTokenFrom(req, body = {}) {
  return String(req.headers.get("x-noortoona-owner-token") || body.ownerToken || "");
}

export function secureJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
