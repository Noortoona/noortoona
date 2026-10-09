import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text } from "react-native";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, Screen } from "@/ui";
import { theme } from "@/theme";

type Home = { profile: { kind: string; code: string; status: string; discount_bps: number }; summary: { customers: number; due: number; paid: number }; commissions: Array<{ amount: number; status: string; created_at: string }> };
const sar = (value: number) => `${(Number(value || 0) / 100).toFixed(2)} ر.س`;
export default function PartnerHome() {
  const auth = useRequireRole("partner");
  const [data, setData] = useState<Home | null>(null);
  useEffect(() => { if (auth.token) api<Home>("/api/partner/home", {}, auth.token).then(setData).catch(e => Alert.alert("شركاء هلا", e?.message || "تعذر التحميل")); }, [auth.token]);
  if (auth.loading || !auth.user) return null;
  return <Screen><BrandHeader title="شركاء هلا" subtitle="إحالاتك وعمولاتك" onLogout={auth.signOut} /><ScrollView contentContainerStyle={styles.body}>
    <Card><Text style={styles.title}>{data?.profile.kind === "influencer" ? "شراكة المشاهير" : "شراكة القاعات"}</Text><Text style={styles.line}>الكود: {data?.profile.code || "—"}</Text><Text style={styles.line}>الرابط: https://noortoona.com/?ref={data?.profile.code || ""}</Text><Text style={styles.line}>خصم العميل: {Number(data?.profile.discount_bps || 0) / 100}%</Text></Card>
    <Card><Text style={styles.title}>الأداء</Text><Text style={styles.line}>العملاء الجدد: {data?.summary.customers || 0}</Text><Text style={styles.line}>المستحق: {sar(data?.summary.due || 0)}</Text><Text style={styles.line}>المدفوع: {sar(data?.summary.paid || 0)}</Text></Card>
    {data?.commissions.map((c, i) => <Card key={i}><Text style={styles.line}>{sar(c.amount)} • {c.status} • {new Date(c.created_at).toLocaleDateString("ar-SA")}</Text></Card>)}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ body: { padding: 18, gap: 12 }, title: { color: theme.colors.ink, fontWeight: "900", fontSize: 20, textAlign: "right" }, line: { color: theme.colors.muted, textAlign: "right", marginTop: 9 } });
