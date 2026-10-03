import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";

type User = { id: string; name: string; email: string; phone?: string; role: "admin" | "supervisor" | "customer"; status: string };

export default function AdminUsers() {
  const auth = useRequireRole("admin");
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (!auth.token) return; const data = await api<{ users: User[] }>("/api/admin/users", {}, auth.token); setUsers(data.users); }, [auth.token]);
  useEffect(() => { load(); }, [load]);
  if (auth.loading || !auth.user) return null;

  async function createSupervisor() {
    setBusy(true);
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify({ name, phone, role: "supervisor" }) }, auth.token);
      setName(""); setPhone("");
      await load();
      Alert.alert("تم", "تم إنشاء حساب المشرف.");
    } catch (e: any) { Alert.alert("تعذر الإنشاء", e?.message || "تحقق من البيانات"); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <BrandHeader title="المستخدمون" subtitle="إنشاء المشرفين ومراجعة الصلاحيات" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.cardTitle}>مشرف جديد</Text>
          <Text style={styles.help}>المشرف لا يستطيع التسجيل بنفسه؛ ينشئه الأدمن ثم يتم تعيينه على المناسبات المطلوبة.</Text>
          <TextInput value={name} onChangeText={setName} placeholder="اسم المشرف" style={styles.input} textAlign="right" />
          <TextInput value={phone} onChangeText={setPhone} placeholder="رقم الجوال" style={styles.input} textAlign="right" keyboardType="phone-pad" />
          <PrimaryButton label="إنشاء حساب المشرف" onPress={createSupervisor} loading={busy} disabled={!name || phone.replace(/\D/g, "").length < 9} />
        </Card>
        <Text style={styles.section}>الحسابات</Text>
        {users.map(u => <Card key={u.id}><View style={styles.user}><View style={styles.copy}><Text style={styles.name}>{u.name}</Text><Text style={styles.email}>{u.phone || u.email}</Text></View><View style={[styles.badge, u.role === "admin" && styles.adminBadge]}><Text style={styles.badgeText}>{u.role === "admin" ? "Admin" : u.role === "supervisor" ? "مشرف" : "عميل"}</Text></View></View></Card>)}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 40, gap: 11 },
  cardTitle: { color: theme.colors.burgundy, fontSize: 19, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 6 },
  help: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 20, marginBottom: 12 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.cream, paddingHorizontal: 13, color: theme.colors.ink, writingDirection: "rtl", marginBottom: 9 },
  section: { marginTop: 8, color: theme.colors.ink, fontSize: 20, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  user: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  copy: { flex: 1 },
  name: { color: theme.colors.ink, fontSize: 16, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  email: { color: theme.colors.muted, marginTop: 4, fontSize: 12, textAlign: "right" },
  badge: { backgroundColor: "#F0E5DB", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  adminBadge: { backgroundColor: theme.colors.burgundy },
  badgeText: { color: theme.colors.gold, fontWeight: "800", fontSize: 12, writingDirection: "rtl" }
});
