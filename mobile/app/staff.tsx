import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "@/api";
import { useRequireStaff } from "@/roleGate";
import { bookingStatus, money, openCustomerWhatsApp, paymentStatus, type Booking } from "@/prebooking";
import { BrandHeader, Card, Empty, PrimaryButton, Screen } from "@/ui";
import { styles } from "@/BookingCheckout";

type Lead = { id: string; name?: string; phone?: string; email?: string; service?: string; marketing_consent?: boolean; created_at?: string; contact_status?: string; notes?: string; assigned_user_id?: string; last_follow_up_at?: string; next_follow_up_at?: string; attribution?: Record<string, unknown>; [key: string]: unknown };
type Notice = { id: string; booking_id?: string; title?: string; status?: string; whatsapp_status?: string; [key: string]: unknown };
type Staff = { id: string; name: string };
type Insights = { visits?: Record<string, number>; bookings?: Record<string, number>; interests?: Record<string, number>; conversion?: Record<string, number> };
const labelValue = (value: unknown) => value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? "محفوظ ضمن تفاصيل الطلب" : String(value);
const source = (value: unknown) => { const a = value && typeof value === "object" ? value as Record<string, unknown> : {}; return String(a.utm_source || a.source || a.referralCode || "غير معروف"); };
const statuses = ["", "pre_booking_received", "contacted", "awaiting_confirmation", "cancelled"];
const followups = [{ value: "new", label: "جديد" }, { value: "contacted", label: "تم التواصل" }, { value: "follow_up", label: "بحاجة لمتابعة" }, { value: "closed", label: "أُغلقت المتابعة" }];
export default function StaffBookings() {
  const auth = useRequireStaff();
  const [tab, setTab] = useState<"bookings" | "leads" | "analytics">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]), [leads, setLeads] = useState<Lead[]>([]), [notices, setNotices] = useState<Notice[]>([]), [staff, setStaff] = useState<Staff[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [selected, setSelected] = useState<Booking | Lead | null>(null);
  const [query, setQuery] = useState(""), [status, setStatus] = useState(""), [payment, setPayment] = useState("");
  const [notes, setNotes] = useState(""), [assigned, setAssigned] = useState(""), [followup, setFollowup] = useState("new"), [nextFollowup, setNextFollowup] = useState("");
  const [busy, setBusy] = useState(false), [refreshing, setRefreshing] = useState(false), [error, setError] = useState(""), [total, setTotal] = useState(0);
  const load = useCallback(async () => {
    if (!auth.token) return;
    setError("");
    try {
      if (tab === "bookings") {
        const params = new URLSearchParams({ q: query }); if (status) params.set("status", status); if (payment) params.set("paymentStatus", payment);
        const d = await api<{ bookings: Booking[]; notifications?: Notice[]; staff?: Staff[]; total?: number }>(`/api/admin/bookings?${params}`, {}, auth.token);
        setBookings(d.bookings); setNotices(d.notifications || []); setStaff(d.staff || []); setTotal(d.total ?? d.bookings.length);
      } else if (tab === "leads") { const d = await api<{ leads: Lead[] }>(`/api/admin/leads?q=${encodeURIComponent(query)}`, {}, auth.token); setLeads(d.leads); }
      else setInsights(await api<Insights>("/api/admin/insights", {}, auth.token));
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل البيانات"); }
    finally { setRefreshing(false); }
  }, [auth.token, tab, query, status, payment]);
  useEffect(() => { const timeout = setTimeout(() => { void load(); }, 350); return () => clearTimeout(timeout); }, [load]);
  function choose(record: Booking | Lead) { setSelected(record); setNotes(String(record.notes || "")); setAssigned(String(record.assigned_user_id || "")); setFollowup(String(record.followup_status || record.contact_status || "new")); setNextFollowup(String(record.next_follow_up_at || "")); }
  async function update(extra: Record<string, unknown> = {}) {
    if (!selected || !auth.token || busy) return;
    if (nextFollowup && Number.isNaN(Date.parse(nextFollowup))) { setError("أدخل موعد متابعة صحيحًا بصيغة 2026-11-05T10:00:00+03:00"); return; }
    setBusy(true); setError("");
    try { await api(tab === "bookings" ? "/api/admin/bookings" : "/api/admin/leads", { method: "PATCH", body: JSON.stringify({ id: selected.id, notes, assignedUserId: assigned || null, ...(tab === "bookings" ? { followupStatus: followup } : { contactStatus: followup }), nextFollowUpAt: nextFollowup || null, ...extra }) }, auth.token); setSelected(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ المتابعة"); }
    finally { setBusy(false); }
  }
  if (auth.loading || !auth.user) return null;
  const fields = selected ? tab === "bookings" ? [
    ["رقم الحجز", selected.booking_number], ["اسم العميل", selected.contact_name || selected.customer_name], ["الجوال", selected.contact_phone || selected.customer_phone], ["تسجيل الطلب", selected.created_at], ["نوع المناسبة", selected.occasion || (selected.event_snapshot as Record<string, unknown> | undefined)?.occasion], ["تاريخ المناسبة", selected.event_date || (selected.event_snapshot as Record<string, unknown> | undefined)?.event_date], ["المدعوون", selected.guest_count], ["التصميم", selected.template || (selected.event_snapshot as Record<string, unknown> | undefined)?.template], ["الباقة", selected.package_name], ["الخدمات", Array.isArray(selected.services) ? selected.services.map(s => s === "supervisor" ? "إشراف المناسبة" : labelValue(s)).join(" • ") : selected.services_json], ["الإجمالي", money(selected.total_amount)], ["الخصم", money(selected.discount_amount)], ["المصدر", source(selected.attribution || selected.attribution_json)], ["كود الإحالة", selected.referral_code], ["آخر متابعة", selected.last_follow_up_at]
  ] : [["التواصل", selected.phone || selected.email], ["تاريخ الاهتمام", selected.created_at], ["الخدمة", selected.service], ["المصدر", source(selected.source || selected.attribution)], ["آخر متابعة", selected.last_follow_up_at], ["الموافقة التسويقية", selected.marketing_consent ? "نعم" : "لا"]] : [];
  return <Screen><BrandHeader title="إدارة الحجوزات" subtitle={auth.user.role === "customer_service" ? "خدمة العملاء — متابعة الحجوزات والعملاء" : "الحجوزات والاهتمامات والإحصائيات الفعلية"} onLogout={auth.signOut} /><ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
    <View style={{ gap: 7 }}>{([{ value: "bookings", label: "إدارة الحجوزات" }, { value: "leads", label: "عملاء ما قبل الإطلاق" }, { value: "analytics", label: "الزيارات والعملاء والاهتمامات" }] as const).map(t => <PrimaryButton key={t.value} label={t.label} secondary={tab !== t.value} onPress={() => { setTab(t.value); setSelected(null); }} />)}</View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {tab !== "analytics" ? <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="البحث برقم الحجز أو الاسم أو الجوال" accessibilityLabel="البحث" /> : null}
    {tab === "bookings" ? <><Text style={styles.label}>حالة الحجز</Text><View style={{ gap: 6 }}>{statuses.map(s => <PrimaryButton key={s} label={(status === s ? "✓ " : "") + (s ? bookingStatus(s) : "كل الحجوزات")} secondary onPress={() => setStatus(s)} />)}</View><Text style={styles.label}>حالة الدفع</Text><View style={{ gap: 6 }}>{["", "pending_payment", "paid"].map(s => <PrimaryButton key={s} label={(payment === s ? "✓ " : "") + (s ? paymentStatus(s) : "كل حالات الدفع")} secondary onPress={() => setPayment(s)} />)}</View><Text style={styles.heading}>الطلبات المطابقة: {total}</Text>
      {notices.length ? <Card><Text style={styles.heading}>إشعارات الحجوزات</Text>{notices.map(n => <Text key={n.id} style={styles.text}>{n.title || "حجز جديد"} • {({ queued: "قيد الانتظار", sent: "أُرسل", delivered: "تم التسليم", failed: "تعذر الإرسال", pending_setup: "بانتظار إعداد واتساب" } as Record<string, string>)[String(n.whatsapp_status || n.status)] || "بانتظار إعداد واتساب"}</Text>)}</Card> : null}
      {!bookings.length && !error ? <Empty title="لا توجد حجوزات حتى الآن" body="تظهر الطلبات بعد نجاح حفظها في قاعدة البيانات فقط." /> : null}{bookings.map(b => <Card key={b.id}><Text style={styles.heading}>{b.booking_number}</Text><Text style={styles.text}>{b.contact_name || b.customer_name || "—"} • {b.contact_phone || b.customer_phone || "—"}</Text><Text style={styles.text}>{bookingStatus(b.booking_status)} • {paymentStatus(b.payment_status)}</Text><Text style={styles.text}>{money(b.total_amount)}</Text><PrimaryButton label="تفاصيل ومتابعة" secondary onPress={() => choose(b)} /></Card>)}</> : null}
    {tab === "leads" ? <><Text style={styles.heading}>Pre-Launch CRM | عملاء ما قبل الإطلاق</Text><Text style={styles.text}>طلبات اهتمام وتواصل ببيانات فعلية. العملاء ذوو الحجوزات غير المدفوعة في تبويب الحجوزات.</Text>{!leads.length && !error ? <Empty title="لا توجد بيانات حتى الآن" body="لا تتحول مشاهدات الصفحات إلى عملاء معروفين تلقائيًا." /> : null}{leads.map(l => <Card key={l.id}><Text style={styles.heading}>{l.name || "بدون اسم"}</Text><Text style={styles.text}>{l.phone || l.email}</Text><Text style={styles.text}>المصدر: {source(l.attribution)}</Text><Text style={styles.text}>الموافقة التسويقية: {l.marketing_consent ? "نعم" : "لا"}</Text><PrimaryButton label="متابعة العميل" secondary onPress={() => choose(l)} /></Card>)}</> : null}
    {tab === "analytics" && insights ? <><Text style={styles.text}>المؤشرات من قاعدة البيانات. الزائر الفريد تقدير بمعرّف وافق عليه صاحبه؛ الجلسة ومشاهدة الصفحة لا تعنيان شخصًا جديدًا.</Text>{([
      ["الزيارات", insights.visits, { total: "مشاهدات الصفحات", today: "مشاهدات اليوم", sevenDays: "آخر 7 أيام", thirtyDays: "آخر 30 يومًا", sessions: "الجلسات", estimatedVisitors: "الزوار الفريدون تقديريًا" }],
      ["الحجوزات", insights.bookings, { total: "إجمالي الطلبات", today: "حجوزات اليوم", preBookings: "الحجوزات المسبقة", pendingPayment: "بانتظار الدفع", paid: "مدفوعة", cancelled: "ملغاة", potentialValueHalalas: "القيمة المحتملة", realizedRevenueHalalas: "الإيرادات المحققة", averageOrderHalalas: "متوسط الطلب" }],
      ["الاهتمامات", insights.interests, { events: "أحداث اهتمام فعلية", knownLeads: "عملاء مهتمون معروفون" }],
      ["التحويلات", insights.conversion, { visitToBookingStartPercent: "من زيارة إلى بدء حجز", bookingCompletionPercent: "إكمال الحجز", knownLeadToBookingPercent: "من اهتمام معروف إلى حجز", prebookingToPaidPercent: "من حجز مسبق إلى دفع" }]
    ] as Array<[string, Record<string, number> | undefined, Record<string, string>]>).map(([title, values, labels]) => <Card key={title}><Text style={styles.heading}>{title}</Text>{Object.entries(labels).map(([key, label]) => <Text key={key} style={styles.text}>{label}: {key.endsWith("Halalas") ? money(values?.[key] || 0) : `${values?.[key] || 0}${key.endsWith("Percent") ? "%" : ""}`}</Text>)}</Card>)}</> : null}
    {selected ? <Card><Text style={styles.heading}>تفاصيل ومتابعة</Text>{fields.map(([label, value]) => <Text key={String(label)} style={styles.text} selectable>{String(label)}: {labelValue(value)}</Text>)}
      {tab === "bookings" ? <PrimaryButton label="فتح محادثة العميل بخصوص الحجز" secondary onPress={() => { void openCustomerWhatsApp(String(selected.contact_phone || selected.customer_phone || ""), String(selected.booking_number)).catch(() => Alert.alert("تعذر فتح واتساب")); }} /> : null}
      {tab === "leads" && selected.phone ? <PrimaryButton label="فتح محادثة العميل" secondary onPress={() => { void openCustomerWhatsApp(String(selected.phone)).catch(() => Alert.alert("تعذر فتح واتساب")); }} /> : null}
      <Text style={styles.label}>الموظفة المسؤولة</Text><View style={{ gap: 6 }}><PrimaryButton label={assigned ? "إلغاء الإسناد" : "✓ دون إسناد"} secondary onPress={() => setAssigned("")} />{staff.map(s => <PrimaryButton key={s.id} label={(assigned === s.id ? "✓ " : "") + s.name} secondary onPress={() => setAssigned(s.id)} />)}<PrimaryButton label={assigned === auth.user.id ? "✓ مسند إليّ" : "إسناد إليّ"} secondary onPress={() => setAssigned(auth.user!.id)} /></View>
      <Text style={styles.label}>حالة المتابعة</Text><View style={{ gap: 6 }}>{followups.map(f => <PrimaryButton key={f.value} label={(followup === f.value ? "✓ " : "") + f.label} secondary onPress={() => setFollowup(f.value)} />)}</View><Text style={styles.label}>موعد المتابعة التالية — اختياري</Text><TextInput style={styles.input} value={nextFollowup} onChangeText={setNextFollowup} placeholder="2026-11-05T10:00:00+03:00" accessibilityLabel="موعد المتابعة التالية" /><Text style={styles.label}>ملاحظات الموظفة</Text><TextInput multiline maxLength={4000} style={[styles.input, { minHeight: 100 }]} value={notes} onChangeText={setNotes} accessibilityLabel="ملاحظات المتابعة" /><PrimaryButton label="حفظ المتابعة" loading={busy} onPress={() => { void update(); }} />
      {tab === "bookings" ? <><PrimaryButton label="تم التواصل" secondary disabled={busy} onPress={() => { void update({ bookingStatus: "contacted" }); }} /><PrimaryButton label="بانتظار التأكيد" secondary disabled={busy} onPress={() => { void update({ bookingStatus: "awaiting_confirmation" }); }} /></> : null}<Text style={styles.text}>لا يمكن اعتماد الدفع أو تعديل الأسعار والصلاحيات من هذه الشاشة.</Text><PrimaryButton label="إغلاق التفاصيل" secondary onPress={() => setSelected(null)} />
    </Card> : null}
  </ScrollView></Screen>;
}
