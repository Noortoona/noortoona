import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, Empty, PrimaryButton, Screen, Stat } from "@/ui";
import { theme } from "@/theme";

type Guest = {
  id: string; name: string; phone?: string; rsvp_status?: string; checked_in_at?: string;
  whatsapp_status?: string; viewed_at?: string; companion_count?: number; children_count?: number;
};
type Dashboard = {
  event: { id: string; title: string; occasion: string; event_date?: string; event_time?: string; location?: string; activity_type?: string };
  guests: Guest[];
};

function rsvpLabel(value?: string) {
  return value === "accepted" ? "مؤكد" : value === "declined" ? "معتذر" : value === "maybe" ? "ربما" : "بانتظار الرد";
}
function waLabel(value?: string) {
  return ({ queued: "قيد الإرسال", sent: "أُرسلت", delivered: "وصلت", read: "قُرئت", failed: "فشل الإرسال" } as Record<string,string>)[value || ""] || "لم تُرسل";
}

export default function CustomerEvent() {
  const auth = useRequireRole("customer");
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Dashboard | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth.token || !id) return;
    try { setData(await api<Dashboard>(`/api/dashboard?event=${encodeURIComponent(String(id))}`, {}, auth.token)); }
    catch (e: any) { Alert.alert("تعذر فتح المناسبة", e?.message || "حاول مرة أخرى"); }
    finally { setRefreshing(false); }
  }, [auth.token, id]);

  useEffect(() => { load(); }, [load]);
  const stats = useMemo(() => {
    const guests = data?.guests || [];
    return {
      total: guests.length,
      accepted: guests.filter(g => g.rsvp_status === "accepted").length,
      viewed: guests.filter(g => Boolean(g.viewed_at)).length,
      checked: guests.filter(g => Boolean(g.checked_in_at)).length
    };
  }, [data]);

  if (auth.loading || !auth.user) return null;

  async function addGuest() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/guests", { method: "POST", body: JSON.stringify({ eventId: id, name: name.trim(), phone: phone.trim() }) }, auth.token);
      setName(""); setPhone(""); await load();
    } catch (e: any) { Alert.alert("تعذر إضافة الضيف", e?.message || "تحقق من البيانات"); }
    finally { setBusy(false); }
  }

  async function sendInvite(guest: Guest) {
    if (!guest.phone) return Alert.alert("رقم الجوال مطلوب", "أضف رقم جوال للضيف قبل الإرسال.");
    setSending(guest.id);
    try {
      const result = await api<any>("/api/whatsapp/send", { method: "POST", body: JSON.stringify({ eventId: id, guestId: guest.id }) }, auth.token);
      Alert.alert("تم قبول طلب الإرسال", result.deliveryConfirmed ? "تم تأكيد التسليم." : "سيظهر التسليم الفعلي بعد تحديث حالة واتساب.");
      await load();
    } catch (e: any) { Alert.alert("تعذر الإرسال", e?.message || "راجع إعدادات واتساب وحالة الرقم."); }
    finally { setSending(null); }
  }

  async function removeGuest(guest: Guest) {
    Alert.alert("حذف الضيف", `هل تريد حذف ${guest.name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try { await api("/api/guests", { method: "DELETE", body: JSON.stringify({ eventId: id, guestId: guest.id }) }, auth.token); await load(); }
        catch (e: any) { Alert.alert("تعذر الحذف", e?.message || "حاول مرة أخرى"); }
      }}
    ]);
  }

  return (
    <Screen>
      <BrandHeader title={data?.event.title || "المناسبة"} subtitle={[data?.event.event_date, data?.event.location].filter(Boolean).join(" • ")} />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.stats}>
          <Stat label="المدعوون" value={stats.total} accent />
          <Stat label="شاهدوا الدعوة" value={stats.viewed} />
          <Stat label="أكدوا" value={stats.accepted} />
          <Stat label="دخلوا" value={stats.checked} />
        </View>

        <Card>
          <Text style={styles.cardTitle}>إضافة ضيف</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="اسم الضيف" textAlign="right" />
          <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder="رقم الجوال" textAlign="right" keyboardType="phone-pad" />
          <PrimaryButton label="+ إضافة الضيف" onPress={addGuest} loading={busy} disabled={!name.trim()} />
        </Card>

        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>الضيوف</Text><Text style={styles.count}>{stats.total}</Text></View>
        {data?.guests?.length ? data.guests.map(g => (
          <Card key={g.id}>
            <View style={styles.guestTop}>
              <View style={styles.guestCopy}>
                <Text style={styles.guestName}>{g.name}</Text>
                <Text style={styles.phone}>{g.phone || "بدون رقم جوال"}</Text>
              </View>
              <View style={styles.status}><Text style={styles.statusText}>{rsvpLabel(g.rsvp_status)}</Text></View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>واتساب: {waLabel(g.whatsapp_status)}</Text>
              <Text style={styles.meta}>{g.checked_in_at ? "✓ تم الدخول" : g.viewed_at ? "شاهد الدعوة" : "لم يفتح الدعوة"}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable disabled={sending === g.id} onPress={() => sendInvite(g)} style={styles.sendBtn}><Text style={styles.sendText}>{sending === g.id ? "جارٍ الإرسال…" : "إرسال واتساب"}</Text></Pressable>
              <Pressable onPress={() => removeGuest(g)} style={styles.deleteBtn}><Text style={styles.deleteText}>حذف</Text></Pressable>
            </View>
          </Card>
        )) : <Empty title="لا يوجد ضيوف بعد" body="أضف أول ضيف، ثم جرّب إرسال الدعوة من هلا." />}
        <PrimaryButton label="رجوع للمناسبات" onPress={() => router.back()} secondary />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 44, gap: 11 },
  stats: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: theme.colors.burgundy, fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 10 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.cream, paddingHorizontal: 13, color: theme.colors.ink, writingDirection: "rtl", marginBottom: 9 },
  sectionRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  sectionTitle: { color: theme.colors.ink, fontSize: 21, fontWeight: "900", writingDirection: "rtl" },
  count: { color: theme.colors.burgundy, fontWeight: "900" },
  guestTop: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  guestCopy: { flex: 1 },
  guestName: { color: theme.colors.ink, fontSize: 17, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  phone: { color: theme.colors.muted, marginTop: 3, fontSize: 12, textAlign: "right" },
  status: { backgroundColor: "#F0E5DB", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: theme.colors.burgundy, fontWeight: "800", fontSize: 12, writingDirection: "rtl" },
  metaRow: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: theme.colors.line, flexDirection: "row-reverse", justifyContent: "space-between", gap: 8 },
  meta: { color: theme.colors.muted, fontSize: 11, writingDirection: "rtl" },
  actions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  sendBtn: { flex: 1, backgroundColor: theme.colors.burgundy, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  sendText: { color: theme.colors.white, fontWeight: "800", writingDirection: "rtl" },
  deleteBtn: { borderWidth: 1, borderColor: "#DDBFC2", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10 },
  deleteText: { color: theme.colors.danger, fontWeight: "800", writingDirection: "rtl" }
});
