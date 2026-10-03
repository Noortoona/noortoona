import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, Empty, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";

type Supervisor = { id: string; name: string; email: string };
type Event = { id: string; title: string; occasion: string; event_date?: string };
type Assignment = { event_id: string; user_id: string; supervisor_name: string };
type Data = { supervisors: Supervisor[]; events: Event[]; assignments: Assignment[] };

export default function AssignmentsScreen() {
  const auth = useRequireRole("admin");
  const [data, setData] = useState<Data>({ supervisors: [], events: [], assignments: [] });
  const [selected, setSelected] = useState("");
  const [busyEvent, setBusyEvent] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.token) return;
    const next = await api<Data>("/api/admin/event-members", {}, auth.token);
    setData(next);
    if (!selected && next.supervisors[0]) setSelected(next.supervisors[0].id);
  }, [auth.token, selected]);

  useEffect(() => { load(); }, [load]);
  const selectedName = useMemo(() => data.supervisors.find(s => s.id === selected)?.name || "", [data.supervisors, selected]);
  if (auth.loading || !auth.user) return null;

  async function assign(eventId: string) {
    if (!selected) return Alert.alert("اختر مشرفًا", "أنشئ أو اختر مشرفًا أولًا.");
    setBusyEvent(eventId);
    try {
      await api("/api/admin/event-members", { method: "POST", body: JSON.stringify({ eventId, userId: selected, action: "assign" }) }, auth.token);
      await load();
      Alert.alert("تم التعيين", `تم تعيين ${selectedName} على المناسبة.`);
    } catch (e: any) { Alert.alert("تعذر التعيين", e?.message || "حاول مرة أخرى"); }
    finally { setBusyEvent(null); }
  }

  async function remove(eventId: string, userId: string) {
    try {
      await api("/api/admin/event-members", { method: "POST", body: JSON.stringify({ eventId, userId, action: "remove" }) }, auth.token);
      await load();
    } catch (e: any) { Alert.alert("تعذر الإلغاء", e?.message || "حاول مرة أخرى"); }
  }

  return (
    <Screen>
      <BrandHeader title="تعيين المشرفين" subtitle="كل مشرف يرى فقط المناسبات التي تم إسنادها له." />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>اختر المشرف</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.supervisors}>
          {data.supervisors.map(s => <Pressable key={s.id} onPress={() => setSelected(s.id)} style={[styles.supervisor, selected === s.id && styles.supervisorActive]}><Text style={[styles.supervisorName, selected === s.id && styles.supervisorNameActive]}>{s.name}</Text><Text style={[styles.supervisorEmail, selected === s.id && styles.supervisorEmailActive]}>{s.email}</Text></Pressable>)}
        </ScrollView>
        {!data.supervisors.length ? <Empty title="لا يوجد مشرفون" body="أنشئ حساب مشرف من شاشة المستخدمين أولًا." /> : null}

        <Text style={styles.section}>المناسبات</Text>
        {data.events.map(event => {
          const assigned = data.assignments.filter(a => a.event_id === event.id);
          return <Card key={event.id}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventMeta}>{[event.occasion, event.event_date].filter(Boolean).join(" • ")}</Text>
            <View style={styles.assignedWrap}>
              {assigned.map(a => <Pressable key={a.user_id} onPress={() => remove(event.id, a.user_id)} style={styles.assigned}><Text style={styles.assignedText}>{a.supervisor_name} ×</Text></Pressable>)}
              {!assigned.length ? <Text style={styles.none}>بدون مشرف</Text> : null}
            </View>
            <PrimaryButton label={busyEvent === event.id ? "جارٍ التعيين…" : selectedName ? `تعيين ${selectedName}` : "اختر مشرفًا"} onPress={() => assign(event.id)} loading={busyEvent === event.id} disabled={!selected} />
          </Card>;
        })}
        {!data.events.length ? <Empty title="لا توجد مناسبات" body="عند إنشاء العملاء لمناسباتهم ستظهر هنا." /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 44, gap: 11 },
  section: { marginTop: 4, color: theme.colors.ink, fontSize: 20, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  supervisors: { flexDirection: "row-reverse", gap: 9, paddingVertical: 4 },
  supervisor: { minWidth: 150, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, padding: 13 },
  supervisorActive: { backgroundColor: theme.colors.burgundy, borderColor: theme.colors.burgundy },
  supervisorName: { color: theme.colors.ink, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  supervisorNameActive: { color: theme.colors.white },
  supervisorEmail: { color: theme.colors.muted, fontSize: 10, marginTop: 4, textAlign: "right" },
  supervisorEmailActive: { color: theme.colors.goldSoft },
  eventTitle: { color: theme.colors.ink, fontWeight: "900", fontSize: 17, textAlign: "right", writingDirection: "rtl" },
  eventMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  assignedWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginVertical: 12 },
  assigned: { backgroundColor: "#F1E5E1", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  assignedText: { color: theme.colors.burgundy, fontWeight: "800", fontSize: 11, writingDirection: "rtl" },
  none: { color: theme.colors.muted, writingDirection: "rtl", fontSize: 12 }
});
