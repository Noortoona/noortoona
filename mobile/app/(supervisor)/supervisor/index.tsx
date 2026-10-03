import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, Empty, Screen, Stat } from "@/ui";
import { theme } from "@/theme";

type Home = { stats: { events: number; guests: number; accepted: number; checkedIn: number }; events: Array<{ id: string; title: string; occasion: string; event_date?: string; location?: string }> };

export default function SupervisorHome() {
  const auth = useRequireRole("supervisor");
  const router = useRouter();
  const [data, setData] = useState<Home | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { if (!auth.token) return; try { setData(await api<Home>("/api/mobile/home", {}, auth.token)); } finally { setRefreshing(false); } }, [auth.token]);
  useEffect(() => { load(); }, [load]);
  if (auth.loading || !auth.user) return null;

  return (
    <Screen>
      <BrandHeader title="لوحة المشرف" subtitle={auth.user.name} onLogout={auth.signOut} />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.stats}>
          <Stat label="مناسبات مكلّف بها" value={data?.stats.events ?? "—"} accent />
          <Stat label="الضيوف" value={data?.stats.guests ?? "—"} />
          <Stat label="أكدوا" value={data?.stats.accepted ?? "—"} />
          <Stat label="دخلوا" value={data?.stats.checkedIn ?? "—"} />
        </View>
        <Text style={styles.sectionTitle}>الاستقبال وQR</Text>
        <Text style={styles.help}>اختر المناسبة ثم افتح الكاميرا. المشرف لا يرى مناسبات غير المعيّنة له.</Text>
        {data?.events?.length ? data.events.map(e => (
          <Card key={e.id}>
            <Pressable style={styles.event} onPress={() => router.push({ pathname: "/supervisor/scanner" as never, params: { eventId: e.id, title: e.title } })}>
              <View style={styles.copy}><Text style={styles.title}>{e.title}</Text><Text style={styles.meta}>{[e.event_date, e.location].filter(Boolean).join(" • ")}</Text></View>
              <View style={styles.scan}><Text style={styles.scanText}>مسح QR</Text></View>
            </Pressable>
          </Card>
        )) : <Empty title="لا توجد مناسبات مكلّف بها" body="عندما يعيّنك الأدمن على مناسبة ستظهر هنا تلقائيًا." />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 40, gap: 11 },
  stats: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  sectionTitle: { marginTop: 14, color: theme.colors.ink, fontWeight: "900", fontSize: 21, textAlign: "right", writingDirection: "rtl" },
  help: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 21 },
  event: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  copy: { flex: 1 },
  title: { color: theme.colors.ink, fontWeight: "900", fontSize: 17, textAlign: "right", writingDirection: "rtl" },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  scan: { backgroundColor: theme.colors.burgundy, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10 },
  scanText: { color: theme.colors.white, fontWeight: "800", writingDirection: "rtl" }
});
