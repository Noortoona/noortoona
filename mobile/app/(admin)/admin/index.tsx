import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, Screen, Stat } from "@/ui";
import { theme } from "@/theme";

type Home = { stats: { events: number; customers: number; supervisors: number }; events: Array<{ id: string; title: string; occasion: string; event_date?: string; location?: string }> };

export default function AdminHome() {
  const auth = useRequireRole("admin");
  const router = useRouter();
  const [data, setData] = useState<Home | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { if (!auth.token) return; try { setData(await api<Home>("/api/mobile/home", {}, auth.token)); } finally { setRefreshing(false); } }, [auth.token]);
  useEffect(() => { load(); }, [load]);
  if (auth.loading || !auth.user) return null;

  return (
    <Screen>
      <BrandHeader title="إدارة هلا" subtitle="نظرة تنفيذية على المنصة" onLogout={auth.signOut} />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.stats}>
          <Stat label="المناسبات" value={data?.stats.events ?? "—"} accent />
          <Stat label="العملاء" value={data?.stats.customers ?? "—"} />
          <Stat label="المشرفون" value={data?.stats.supervisors ?? "—"} />
          <Stat label="حالة المنصة" value="نشطة" />
        </View>
        <Card>
          <Pressable style={styles.management} onPress={() => router.push("/admin/users" as never)}>
            <View><Text style={styles.manageTitle}>المستخدمون والصلاحيات</Text><Text style={styles.manageHelp}>إنشاء مشرفين وإدارة حسابات العملاء.</Text></View>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
        </Card>
        <Card>
          <Pressable style={styles.management} onPress={() => router.push("/admin/assignments" as never)}>
            <View><Text style={styles.manageTitle}>تعيين المشرفين</Text><Text style={styles.manageHelp}>اربط كل مشرف بالمناسبات التي يديرها فقط.</Text></View>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
        </Card>
        <Card>
          <Pressable style={styles.management} onPress={() => router.push("/admin/partners" as never)}>
            <View><Text style={styles.manageTitle}>شركاء العمل والمشاهير</Text><Text style={styles.manageHelp}>الأكواد والإحالات والعمولات المستحقة.</Text></View>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
        </Card>
        <Text style={styles.sectionTitle}>أحدث المناسبات</Text>
        {data?.events?.map(e => <Card key={e.id}><Text style={styles.eventTitle}>{e.title}</Text><Text style={styles.eventMeta}>{[e.occasion, e.event_date, e.location].filter(Boolean).join(" • ")}</Text></Card>)}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 40, gap: 11 },
  stats: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  management: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  manageTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  manageHelp: { color: theme.colors.muted, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  arrow: { color: theme.colors.gold, fontSize: 32 },
  sectionTitle: { marginTop: 10, fontSize: 20, fontWeight: "900", color: theme.colors.ink, textAlign: "right", writingDirection: "rtl" },
  eventTitle: { color: theme.colors.ink, fontSize: 16, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  eventMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 4, textAlign: "right", writingDirection: "rtl" }
});
