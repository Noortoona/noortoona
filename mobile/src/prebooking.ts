import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { api } from "./api";

export type Booking = {
  id: string; booking_number: string; event_id?: string; booking_status: string; payment_status: string;
  total_amount: number; base_amount?: number; addon_amount?: number; discount_amount?: number;
  package_name?: string; guest_count?: number; created_at?: string; event_date?: string; title?: string; occasion?: string;
  contact_name?: string; contact_phone?: string; contact_email?: string; customer_name?: string; customer_phone?: string;
  services?: unknown; services_json?: unknown; design_json?: unknown; event_snapshot?: Record<string, unknown>;
  attribution?: Record<string, unknown>; attribution_json?: Record<string, unknown>; referral_code?: string;
  assigned_user_id?: string; assigned_name?: string; last_followup_at?: string; followup_status?: string; next_followup_at?: string; notes?: string;
  [key: string]: unknown;
};
export type BookingQuote = { baseAmount: number; addonAmount: number; discountAmount: number; total: number; currency: string; packageCode: string; packageName: string; guestLimit: number };
export const money = (value: unknown) => `${(Number(value || 0) / 100).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
export const bookingStatus = (value: string) => ({ pre_booking_received: "تم استلام الحجز المبدئي", contacted: "تم التواصل", awaiting_confirmation: "بانتظار التأكيد", confirmed: "مؤكد", cancelled: "ملغي" }[value] || value);
export const paymentStatus = (value: string) => ({ pending_payment: "بانتظار الدفع", paid: "مدفوع", failed: "تعذر الدفع", cancelled: "ملغي" }[value] || value);
const storageKey = (userId: string, eventId: string) => `hala.booking.retry.${userId}.${eventId}`;
const pending = new Map<string, Promise<{ idempotencyKey: string; accessToken: string }>>();
export function bookingRetry(userId: string, eventId: string) {
  const key = storageKey(userId, eventId);
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const saved = await SecureStore.getItemAsync(key);
    if (saved) return JSON.parse(saved) as { idempotencyKey: string; accessToken: string };
    const bytes = await Crypto.getRandomBytesAsync(32);
    const ticket = { idempotencyKey: Crypto.randomUUID(), accessToken: Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("") };
    await SecureStore.setItemAsync(key, JSON.stringify(ticket));
    return ticket;
  })();
  pending.set(key, task);
  void task.catch(() => pending.delete(key));
  return task;
}
export async function rememberBooking(id: string, accessToken: string) {
  await SecureStore.setItemAsync(`hala.booking.access.${id}`, accessToken);
  await SecureStore.setItemAsync("hala.booking.last",id);
}
export async function supportPhone() {
  try {
    const data = await api<{ supportPhone: string }>("/api/public-settings");
    if (/^9665\d{8}$/.test(data.supportPhone)) return data.supportPhone;
  } catch { /* Support stays available if settings cannot be loaded. */ }
  return "966532763736";
}
export async function openSupport(number?: string) {
  const phone = await supportPhone();
  const text = number ? `مرحبًا فريق هلا، لدي استفسار بخصوص حجزي رقم ${number}` : "مرحبًا فريق هلا، أرغب بالاستفسار عن خدمات هلا";
  await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
}
export async function attribution() {
  const initial = await Linking.getInitialURL();
  if (initial) {
    try {
      const url = new URL(initial);
      const data: Record<string, string> = {};
      for (const name of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referralCode"]) {
        const value = url.searchParams.get(name) || (name === "referralCode" ? url.searchParams.get("ref") : "");
        if (value) data[name] = value.slice(0, 160);
      }
      if (Object.keys(data).length) await SecureStore.setItemAsync("hala.attribution", JSON.stringify(data));
    } catch { /* Invalid external links are never attribution evidence. */ }
  }
  const stored = await SecureStore.getItemAsync("hala.attribution");
  return stored ? JSON.parse(stored) as Record<string, string> : {};
}
export async function openCustomerWhatsApp(phone: string, number?: string) {
  const normalized = phone.replace(/\D/g, "").replace(/^0/, "966");
  if (!/^9665\d{8}$/.test(normalized)) throw new Error("رقم العميل غير صالح");
  await Linking.openURL(`https://wa.me/${normalized}?text=${encodeURIComponent(number ? `مرحبًا، معك فريق هلا بخصوص طلب حجزك رقم ${number}` : "مرحبًا، معك فريق هلا بخصوص طلب التواصل")}`);
}
export async function analyticsConsent() { return (await SecureStore.getItemAsync("hala.analytics.consent")) === "true"; }
export async function setAnalyticsConsent(value: boolean) { await SecureStore.setItemAsync("hala.analytics.consent", value ? "true" : "false"); }
let sessionId: string | null = null;
export async function analyticsContext() {
  if (!(await analyticsConsent())) return {};
  sessionId ||= Crypto.randomUUID();
  let visitorId = await SecureStore.getItemAsync("hala.analytics.visitor");
  if (!visitorId) { visitorId = Crypto.randomUUID(); await SecureStore.setItemAsync("hala.analytics.visitor", visitorId); }
  return { consent: true, sessionId, visitorId };
}
export async function track(event: string, path: string, metadata: Record<string, string> = {}) {
  try {
    if (!(await analyticsConsent())) return;
    const context = await analyticsContext();
    await api("/api/analytics/track", { method: "POST", body: JSON.stringify({ eventId: Crypto.randomUUID(), ...context, event, path, attribution: await attribution(), metadata }) });
  } catch { /* Optional analytics never blocks booking or login. */ }
}
