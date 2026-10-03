import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, Empty, PrimaryButton, Screen, Stat } from "@/ui";
import { theme } from "@/theme";

type Home = {
  stats: { events: number; guests: number; accepted: number; checkedIn: number };
  events: Array<{ id: string; title: string; occasion: string; event_date?: string; location?: string }>;
};

export default function CustomerHome() {
  const auth = useRequireRole("customer");
  const router = useRouter();
  const [data, setData] = useState<Home | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth.token) return;
    try { setData(await api<Home>("/api/mobile/home", {}, auth.token)); } finally { setRefreshing(false); }
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);
  if (auth.loading || !auth.user) return null;

  return (
    <Screen>
      <BrandHeader title={`هلا، ${auth.user.name}`} subtitle="مناسباتك وضيوفك في مكان واحد" onLogout={auth.signOut} />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>مساحتك الخاصة</Text>
          <Text style={styles.heroTitle}>من الفكرة إلى وصول الضيف</Text>
          <Text style={styles.heroText}>أنشئ الدعوة، أرسلها، وتابع التأكيد والدخول من تطبيق واحد.</Text>
          <PrimaryButton label="+ إنشاء دعوة جديدة" onPress={() => router.push("/customer/create" as never)} />
        </View>
        <View style={styles.stats}>
          <Stat label="مناسباتي" value={data?.stats.events ?? "—"} accent />
          <Stat label="المدعوون" value={data?.stats.guests ?? "—"} />
          <Stat label="أكدوا الحضور" value={data?.stats.accepted ?? "—"} />
          <Stat label="تم دخولهم" value={data?.stats.checkedIn ?? "—"} />
        </View>
        <Text style={styles.sectionTitle}>آخر المناسبات</Text>
        {data?.events?.length ? data.events.map(e => (
          <Card key={e.id}>
            <Pressable style={styles.eventRow}>
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.eventMeta}>{[e.occasion, e.event_date, e.location].filter(Boolean).join(" • ")}</Text>
              </View>
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
          </Card>
        )) : <Empty title="ما عندك مناسبة حتى الآن" body="ابدأ بأول دعوة، وهلا يرتب لك بقية الخطوات." />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 40, gap: 12 },
  hero: { backgroundColor: theme.colors.burgundyDeep, borderRadius: 26, padding: 22, gap: 10 },
  eyebrow: { color: theme.colors.gold, textAlign: "right", writingDirection: "rtl", fontWeight: "800" },
  heroTitle: { color: theme.colors.white, fontSize: 25, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  heroText: { color: theme.colors.goldSoft, lineHeight: 22, textAlign: "right", writingDirection: "rtl", marginBottom: 5 },
  stats: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  sectionTitle: { marginTop: 12, fontSize: 20, fontWeight: "900", color: theme.colors.ink, textAlign: "right", writingDirection: "rtl" },
  eventRow: { flexDirection: "row-reverse", alignItems: "center" },
  eventCopy: { flex: 1 },
  eventTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  eventMeta: { color: theme.colors.muted, marginTop: 5, fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  arrow: { color: theme.colors.gold, fontSize: 30, marginLeft: 8 }
});
