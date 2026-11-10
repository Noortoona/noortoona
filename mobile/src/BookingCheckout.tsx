import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "./api";
import { useAuth } from "./auth";
import { normalizeDigits, normalizeSaudiPhone } from "./input";
import { analyticsContext, attribution, bookingRetry, money, openSupport, rememberBooking, track, type Booking, type BookingQuote } from "./prebooking";
import { BrandHeader, Card, PrimaryButton, Screen } from "./ui";
import { theme } from "./theme";
import { useI18n } from "./i18n";

type Event = { title: string; occasion: string; event_date?: string; location?: string; package_name: string; template: string; design_json?: { supervisorPreference?: string } };
export default function BookingCheckout({ eventId }: { eventId?: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState("");
  const [name, setName] = useState(auth.user?.name || "");
  const [phone, setPhone] = useState(auth.user?.phone || "");
  const [email, setEmail] = useState(auth.user?.email || "");
  const [coupon, setCoupon] = useState("");
  const [supervisor, setSupervisor] = useState(false);
  const [consent, setConsent] = useState(false);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const lock = useRef(false);
  const version = useRef(0);
  const contactStarted = useRef(false);
  const markContact = () => { if (!contactStarted.current) { contactStarted.current = true; void track("contact_started", "/mobile/customer/payment"); } };
  const selection = { eventId, guestCount: Number(normalizeDigits(guests)), services: supervisor ? ["supervisor"] : [], referralCode: coupon.trim() };
  useEffect(() => {
    if (!eventId) return;
    let current = true;
    SecureStore.getItemAsync(`hala.event.owner.${eventId}`).then(ownerToken=>api<{ event: Event }>(`/api/dashboard?event=${encodeURIComponent(eventId)}`, {headers:ownerToken?{"x-noortoona-owner-token":ownerToken}:{}}, auth.token)).then(d => { if (current) { setEvent(d.event); setSupervisor(Boolean(d.event.design_json?.supervisorPreference)); } }).catch(e => { if (current) setError(e.message); });
    attribution().then(a => { if (current && a.referralCode) setCoupon(a.referralCode); }).catch(() => undefined);
    return () => { current = false; };
  }, [eventId, auth.token]);
  useEffect(() => { version.current++; setQuote(null); }, [guests, coupon, supervisor]);
  const requestQuote = useCallback(async () => {
    if (!eventId) return;
    const count = Number(normalizeDigits(guests));
    if (!Number.isSafeInteger(count) || count < 1) { setError(t("أدخل عدد المدعوين الصحيح.")); return; }
    const current = ++version.current;
    setQuoting(true); setError("");
    try {
      const response = await api<{ quote: BookingQuote }>("/api/bookings/quote", { method: "POST", body: JSON.stringify({ eventId, guestCount: count, services: supervisor ? ["supervisor"] : [], referralCode: coupon.trim() }) }, auth.token);
      if (current === version.current) { setQuote(response.quote); void track("price_viewed", "/mobile/customer/payment", { packageCode: response.quote.packageCode }); }
    } catch (e) { if (current === version.current) setError(e instanceof Error ? e.message : t("تعذر احتساب السعر")); }
    finally { setQuoting(false); }
  }, [eventId, auth.token, guests, supervisor, coupon]);
  async function submit() {
    if (lock.current || !quote || !eventId) return;
    const normalized = normalizeSaudiPhone(phone);
    if (!name.trim() || !normalized || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) { setError(t("أدخل الاسم ورقم الجوال الصحيح والبريد إن رغبت.")); return; }
    if (supervisor && !event?.design_json?.supervisorPreference) { setError(t("عد إلى تفاصيل الدعوة وحدد مشرفًا أو مشرفة قبل إضافة الخدمة.")); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const retry = await bookingRetry(auth.user?.id || "guest", eventId);
      const data = await api<{ booking: Booking; accessToken?: string }>("/api/bookings", { method: "POST", body: JSON.stringify({ ...selection, ...retry, ownerToken: await SecureStore.getItemAsync(`hala.event.owner.${eventId}`), expectedTotal: quote.total, contact: { name: name.trim(), phone: normalized, email: email.trim() }, supervisorPreference: event?.design_json?.supervisorPreference, attribution: await attribution(), ...await analyticsContext(), marketingConsent: consent }) }, auth.token);
      // The saved booking is the only success signal. SecureStore failure must not hide it.
      setBooking(data.booking);
      await rememberBooking(data.booking.id, data.accessToken || retry.accessToken).catch(() => undefined);
    } catch (e) { setError(e instanceof Error ? e.message : t("تعذر حفظ الحجز. يمكنك المحاولة مجددًا دون إنشاء طلب آخر.")); }
    finally { setBusy(false); lock.current = false; }
  }
  if (booking) return <Screen><BrandHeader title="تم تسجيل طلب حجزك بنجاح! ✨" /><ScrollView contentContainerStyle={styles.body}><Card><Text style={[styles.heading, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("شكرًا لاختيارك هلا.")}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("تم استلام تفاصيل مناسبتك وحفظ طلبك برقم:")}</Text><Text selectable style={styles.number}>{booking.booking_number}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("سيتواصل معك فريق هلا قريبًا لاستكمال إجراءات الدفع والتأكيد النهائي.")}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("يمكنك متابعة تفاصيل طلبك من حسابك في هلا.")}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("تسجيل الطلب لا يعني إتمام الدفع أو اعتماد الحجز النهائي.")}</Text><Text style={[styles.heading, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("لحظتك .. تبدأ بهلا 🤍")}</Text></Card><PrimaryButton label="عرض حجزي" onPress={() => router.replace({ pathname: "/customer/bookings" as never, params: { id: booking.id } })} /><PrimaryButton label="التواصل مع خدمة العملاء" secondary onPress={() => { void openSupport(booking.booking_number).catch(() => Alert.alert(t("تعذر فتح واتساب"), t("يمكنك العودة لحجزك من حسابك."))); }} /></ScrollView></Screen>;
  return <Screen><BrandHeader title="تأكيد طلب الحجز" subtitle="احفظ طلبك الآن، وسنتواصل لاستكمال الدفع والتأكيد" /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
    {event ? <Card><Text style={[styles.heading, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{event.title}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{[event.occasion, event.event_date, event.location].filter(Boolean).join(" • ")}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{event.template} • {event.package_name}</Text></Card> : <Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("جاري تحميل تفاصيل المناسبة…")}</Text>}
    <Text style={[styles.label, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("عدد المدعوين")}</Text><TextInput value={guests} onChangeText={setGuests} keyboardType="number-pad" style={[styles.input, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]} accessibilityLabel={t("عدد المدعوين")} />
    <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}><Switch value={supervisor} onValueChange={setSupervisor} accessibilityLabel={t("إضافة مشرف أو مشرفة")} /><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("إضافة مشرف / مشرفة حسب التفضيل المحدد")}</Text></View>
    <Text style={[styles.label, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("كود الخصم أو الإحالة")}</Text><TextInput value={coupon} onChangeText={setCoupon} autoCapitalize="characters" style={[styles.input, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]} accessibilityLabel={t("كود الخصم أو الإحالة")} />
    <PrimaryButton label="عرض السعر النهائي" onPress={() => { void requestQuote(); }} loading={quoting} disabled={!event || busy} secondary />
    {quote ? <Card><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{quote.packageName}: {money(quote.baseAmount)}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("الخدمات الإضافية:")} {money(quote.addonAmount)}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("الخصم:")} {money(quote.discountAmount)}</Text><Text style={[styles.heading, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("الإجمالي:")} {money(quote.total)}</Text><Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("لا يُخصم منك أي مبلغ عند تأكيد الطلب المبدئي.")}</Text></Card> : null}
    <Text style={[styles.label, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("اسم العميل")}</Text><TextInput value={name} onFocus={markContact} onChangeText={setName} style={[styles.input, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]} accessibilityLabel={t("اسم العميل")} autoComplete="name" />
    <Text style={[styles.label, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("رقم الجوال")}</Text><TextInput value={phone} onFocus={markContact} onChangeText={setPhone} style={[styles.input, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]} keyboardType="phone-pad" accessibilityLabel={t("رقم الجوال")} autoComplete="tel" />
    <Text style={[styles.label, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("البريد الإلكتروني — اختياري")}</Text><TextInput value={email} onFocus={markContact} onChangeText={setEmail} style={[styles.input, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]} keyboardType="email-address" autoCapitalize="none" accessibilityLabel={t("البريد الإلكتروني")} />
    <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}><Switch value={consent} onValueChange={setConsent} accessibilityLabel={t("الموافقة الاختيارية على الرسائل التسويقية")} /><Text style={[styles.flexText, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("أوافق اختياريًا على استقبال أخبار وعروض هلا. لا يؤثر اختياري على الحجز.")}</Text></View>
    {error ? <Text accessibilityRole="alert" style={[styles.error, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{error}</Text> : null}
    <Text style={[styles.text, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t("الحجز المبدئي لا يعني الدفع أو الاعتماد النهائي. واتساب للمساعدة فقط.")}</Text>
    <PrimaryButton label="تأكيد طلب الحجز" onPress={() => { void submit(); }} loading={busy} disabled={!quote || !event || quoting} />
    <PrimaryButton label="خدمة العملاء" secondary onPress={() => { void openSupport().catch(() => Alert.alert(t("تعذر فتح واتساب"))); }} />
    <PrimaryButton label="رجوع" secondary onPress={() => router.back()} />
  </ScrollView></Screen>;
}
export const styles = StyleSheet.create({ body: { padding: 20, gap: 12, paddingBottom: 50 }, text: { color: theme.colors.ink, textAlign: "right", writingDirection: "rtl", lineHeight: 24 }, flexText: { color: theme.colors.ink, textAlign: "right", writingDirection: "rtl", lineHeight: 24, flex: 1 }, heading: { color: theme.colors.ink, textAlign: "right", writingDirection: "rtl", fontSize: 20, fontWeight: "800", marginVertical: 8 }, label: { color: theme.colors.ink, textAlign: "right", writingDirection: "rtl", fontWeight: "700" }, input: { borderWidth: 1, borderColor: theme.colors.line, borderRadius: 14, backgroundColor: theme.colors.paper, color: theme.colors.ink, minHeight: 50, paddingHorizontal: 14, textAlign: "right" }, row: { flexDirection: "row", alignItems: "center", gap: 10 }, error: { color: theme.colors.danger, textAlign: "right", lineHeight: 23 }, number: { color: theme.colors.gold, fontSize: 27, fontWeight: "900", textAlign: "center", paddingVertical: 14 } });
