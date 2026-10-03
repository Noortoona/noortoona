import { getDatabase } from "@netlify/database";

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const clean = String(hex || "");
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPassword(password, saltHex = "") {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 },
    key,
    256
  );
  return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
}

export async function verifyPassword(password, salt, expectedHash) {
  const result = await hashPassword(password, salt);
  if (result.hash.length !== String(expectedHash || "").length) return false;
  let mismatch = 0;
  for (let i = 0; i < result.hash.length; i++) mismatch |= result.hash.charCodeAt(i) ^ String(expectedHash).charCodeAt(i);
  return mismatch === 0;
}

export async function ensureAuthSchema() {
  return getDatabase();
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    status: user.status,
  };
}

export async function createSession(userId) {
  const db = await ensureAuthSchema();
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${userId}, ${expiresAt.toISOString()}::timestamptz)
  `;
  return { token, expiresAt: expiresAt.toISOString() };
}

export function bearerToken(req) {
  const header = String(req.headers.get("authorization") || "");
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function getAuth(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const db = await ensureAuthSchema();
  const tokenHash = await sha256(token);
  const rows = await db.sql`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.status, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) return null;
  if (user.status !== "active" || new Date(user.expires_at).getTime() <= Date.now()) {
    await db.sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
    return null;
  }
  return { user: publicUser(user), tokenHash };
}

export async function revokeSession(req) {
  const token = bearerToken(req);
  if (!token) return;
  const db = await ensureAuthSchema();
  await db.sql`DELETE FROM sessions WHERE token_hash = ${await sha256(token)}`;
}

export async function requireRole(req, allowed = []) {
  const auth = await getAuth(req);
  if (!auth) return { ok: false, status: 401, error: "يجب تسجيل الدخول" };
  if (allowed.length && !allowed.includes(auth.user.role)) {
    return { ok: false, status: 403, error: "لا تملك صلاحية لهذا الإجراء" };
  }
  return { ok: true, ...auth };
}

export async function linkEventMember(eventId, userId, memberRole = "owner") {
  const db = await ensureAuthSchema();
  await db.sql`
    INSERT INTO event_members (event_id, user_id, member_role)
    VALUES (${eventId}, ${userId}, ${memberRole})
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET member_role = EXCLUDED.member_role
  `;
}

export async function canAccessEvent(user, eventId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const db = await ensureAuthSchema();
  const rows = await db.sql`
    SELECT 1
    FROM event_members
    WHERE event_id = ${eventId} AND user_id = ${user.id}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}
