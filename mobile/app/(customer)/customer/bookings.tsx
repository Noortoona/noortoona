import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { bookingStatus, money, openSupport, paymentStatus, type Booking } from "@/prebooking";
import { BrandHeader, Card, Empty, PrimaryButton, Screen } from "@/ui";
import { styles } from "@/BookingCheckout";

export default function CustomerBookings() {
  const auth = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth.token && !id) return;
    setError("");
    try {
      if (id) { const data = await api<{ booking: Booking }>(`/api/bookings?id=${encodeURIComponent(id)}`, {headers:{"x-booking-token":await SecureStore.getItemAsync(`hala.booking.access.${id}`)||""}}, auth.token); setBookings([data.booking]); }
      else { const data = await api<{ bookings: Booking[] }>("/api/bookings", {}, auth.token); setBookings(data.bookings); }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل الحجوزات"); }
    finally { setRefreshing(false); }
  }, [id, auth.token]);
  useEffect(() => { void load(); }, [load]);
  if (auth.loading) return null;
  return <Screen><BrandHeader title="حجوزاتي" subtitle="الحالة الفعلية لطلباتك المحفوظة في هلا" /><ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
    {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><PrimaryButton label="إعادة المحاولة" onPress={() => { void load(); }} /></> : null}
    {!error && !bookings.length ? <Empty title="لا توجد حجوزات حتى الآن" body="سيظهر طلبك هنا بعد نجاح تسجيل الحجز المبدئي." /> : null}
    {bookings.map(b => <Card key={b.id}><Text selectable style={styles.number}>{b.booking_number}</Text><Text style={styles.heading}>{b.title || String(b.event_snapshot?.title || "مناسبتك")}</Text><Text style={styles.text}>المناسبة: {b.occasion || String(b.event_snapshot?.occasion || "—")}</Text><Text style={styles.text}>التاريخ: {b.event_date || String(b.event_snapshot?.event_date || "—")}</Text><Text style={styles.text}>عدد المدعوين: {b.guest_count ?? "—"}</Text><Text style={styles.text}>الباقة: {b.package_name || "—"}</Text><Text style={styles.text}>الإجمالي: {money(b.total_amount)}</Text><Text style={styles.text}>حالة الحجز: {bookingStatus(b.booking_status)}</Text><Text style={styles.text}>حالة الدفع: {paymentStatus(b.payment_status)}</Text><Text style={styles.text}>تسجيل الطلب لا يعني إتمام الدفع أو اعتماد الحجز النهائي.</Text><PrimaryButton label="التواصل مع خدمة العملاء بخصوص حجزي" secondary onPress={() => { void openSupport(b.booking_number).catch(() => Alert.alert("تعذر فتح واتساب")); }} /></Card>)}
  </ScrollView></Screen>;
}
