import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";

type Partner = { user_id: string; name: string; phone: string; kind: string; code: string; status: string; customers: number; commission_due: number; commission_paid: number };
const money = (x: number) => `${(Number(x || 0) / 100).toFixed(2)} ر.س`;
export default function AdminPartners() {
  const auth = useRequireRole("admin");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [code, setCode] = useState("");
  const [kind, setKind] = useState<"venue" | "influencer">("venue"); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (auth.token) { const data = await api<{ partners: Partner[] }>("/api/admin/partners", {}, auth.token); setPartners(data.partners); } }, [auth.token]);
  useEffect(() => { load().catch(e => Alert.alert("شركاء هلا", e?.message || "تعذر التحميل")); }, [load]);
  if (auth.loading || !auth.user) return null;
  async function save() {
    setBusy(true);
    try { await api("/api/admin/partners", { method: "POST", body: JSON.stringify({ name, phone, code, kind }) }, auth.token); setName(""); setPhone(""); setCode(""); await load(); }
    catch (e: any) { Alert.alert("تعذر الحفظ", e?.message || "تحقق من البيانات"); } finally { setBusy(false); }
  }
  async function toggle(p: Partner) {
    try { await api("/api/admin/partners", { method: "PATCH", body: JSON.stringify({ userId: p.user_id, status: p.status === "active" ? "paused" : "active" }) }, auth.token); await load(); }
    catch (e: any) { Alert.alert("تعذر التحديث", e?.message || "حاول مرة أخرى"); }
  }
  return <Screen><BrandHeader title="شركاء العمل" subtitle="قاعات الأفراح والمشاهير" /><ScrollView contentContainerStyle={styles.body}>
    <Card><Text style={styles.title}>إضافة شريك</Text><TextInput style={styles.input} placeholder="الاسم" value={name} onChangeText={setName} /><TextInput style={styles.input} placeholder="رقم الجوال" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><TextInput style={styles.input} placeholder="كود فريد بالإنجليزية" value={code} onChangeText={setCode} autoCapitalize="characters" />
      <View style={styles.row}><PrimaryButton label="قاعة" secondary={kind !== "venue"} onPress={() => setKind("venue")} /><PrimaryButton label="مشهور" secondary={kind !== "influencer"} onPress={() => setKind("influencer")} /></View><PrimaryButton label="حفظ الشريك" onPress={save} loading={busy} /></Card>
    {partners.map(p => <Card key={p.user_id}><Text style={styles.title}>{p.name} • {p.code}</Text><Text style={styles.line}>{p.kind === "venue" ? "قاعة" : "مشهور"} • {p.customers} عميل • {p.status === "active" ? "نشط" : "متوقف"}</Text><Text style={styles.line}>مستحق {money(p.commission_due)} • مدفوع {money(p.commission_paid)}</Text><PrimaryButton label={p.status === "active" ? "إيقاف الكود" : "تفعيل الكود"} secondary onPress={() => toggle(p)} /></Card>)}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ body: { padding: 18, gap: 12 }, title: { color: theme.colors.ink, fontSize: 19, fontWeight: "900", textAlign: "right", marginBottom: 8 }, line: { color: theme.colors.muted, textAlign: "right", marginBottom: 9 }, input: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: 13, marginBottom: 9, textAlign: "right", color: theme.colors.ink }, row: { flexDirection: "row-reverse", gap: 9, marginBottom: 9 } });
