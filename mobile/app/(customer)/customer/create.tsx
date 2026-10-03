import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";

const OCCASIONS = [
  { key: "wedding", label: "زواج", emoji: "✦", twoNames: true },
  { key: "engagement", label: "ملكة / خطوبة", emoji: "♢", twoNames: true },
  { key: "graduation", label: "تخرج", emoji: "⌁", twoNames: false },
  { key: "birthday", label: "عيد ميلاد", emoji: "◌", twoNames: false },
  { key: "activity", label: "نشاط / تجمع", emoji: "⚡", twoNames: false },
  { key: "custom", label: "أخرى", emoji: "+", twoNames: false }
] as const;

export default function CreateEvent() {
  const auth = useRequireRole("customer");
  const router = useRouter();
  const [occasionKey, setOccasionKey] = useState<(typeof OCCASIONS)[number]["key"]>("wedding");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [shareAmount, setShareAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => OCCASIONS.find(o => o.key === occasionKey)!, [occasionKey]);

  if (auth.loading || !auth.user) return null;

  async function create() {
    if (!name1.trim()) return Alert.alert("أكمل البيانات", occasionKey === "activity" ? "اكتب اسم النشاط." : "اكتب الاسم.");
    if (selected.twoNames && !name2.trim()) return Alert.alert("أكمل البيانات", "هذا النوع يحتاج الاسمين.");
    setBusy(true);
    try {
      const occasion = occasionKey === "wedding" ? "زواج" : occasionKey === "engagement" ? "ملكة / خطوبة" : occasionKey === "graduation" ? "تخرج" : occasionKey === "birthday" ? "عيد ميلاد" : occasionKey === "activity" ? "تجمع ونشاط" : "أخرى";
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          occasion,
          name1: name1.trim(),
          name2: selected.twoNames ? name2.trim() : "",
          title: occasionKey === "activity" ? name1.trim() : selected.twoNames ? `${occasion} ${name1.trim()} و ${name2.trim()}` : `${occasion} ${name1.trim()}`,
          date: date.trim() || null,
          time: time.trim() || null,
          location: location.trim(),
          capacity: occasionKey === "activity" ? Number(capacity || 0) : null,
          shareAmount: occasionKey === "activity" ? Number(shareAmount || 0) : 0,
          waitlistEnabled: occasionKey === "activity",
          template: "لؤلؤة",
          package: "البداية",
          design: { occasionKey, headline: "هلا بضيوفك من أول دعوة" }
        })
      }, auth.token);
      Alert.alert("تم إنشاء المناسبة", "تم ربط المناسبة بحسابك. الخطوة التالية ستكون اختيار القالب والضيوف.", [{ text: "ممتاز", onPress: () => router.replace("/customer" as never) }]);
    } catch (e: any) {
      Alert.alert("تعذر الإنشاء", e?.message || "حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BrandHeader title="دعوة جديدة" subtitle="الحقول تتغير حسب نوع الدعوة، بدون خلط بين المناسبات." />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>نوع الدعوة</Text>
        <View style={styles.grid}>
          {OCCASIONS.map(o => <Pressable key={o.key} onPress={() => { setOccasionKey(o.key); setName2(""); }} style={[styles.choice, occasionKey === o.key && styles.choiceActive]}><Text style={styles.choiceIcon}>{o.emoji}</Text><Text style={[styles.choiceText, occasionKey === o.key && styles.choiceTextActive]}>{o.label}</Text></Pressable>)}
        </View>

        <Text style={styles.label}>{occasionKey === "activity" ? "اسم النشاط" : occasionKey === "graduation" ? "اسم الخريج / الخريجة" : occasionKey === "birthday" ? "اسم صاحب المناسبة" : selected.twoNames ? "الاسم الأول" : "اسم المناسبة"}</Text>
        <TextInput value={name1} onChangeText={setName1} style={styles.input} textAlign="right" placeholder="اكتب هنا" />
        {selected.twoNames ? <>
          <Text style={styles.label}>الاسم الثاني</Text>
          <TextInput value={name2} onChangeText={setName2} style={styles.input} textAlign="right" placeholder={occasionKey === "wedding" ? "اسم العروس / الطرف الثاني" : "الاسم الثاني"} />
        </> : null}

        <View style={styles.row}>
          <View style={styles.half}><Text style={styles.label}>التاريخ</Text><TextInput value={date} onChangeText={setDate} style={styles.input} textAlign="right" placeholder="2026-12-20" /></View>
          <View style={styles.half}><Text style={styles.label}>الوقت</Text><TextInput value={time} onChangeText={setTime} style={styles.input} textAlign="right" placeholder="20:30" /></View>
        </View>

        <Text style={styles.label}>الموقع</Text>
        <TextInput value={location} onChangeText={setLocation} style={styles.input} textAlign="right" placeholder="اسم القاعة أو الموقع" />

        {occasionKey === "activity" ? <View style={styles.activityBox}>
          <Text style={styles.activityTitle}>إعدادات النشاط</Text>
          <Text style={styles.activityHelp}>هنا لا نطلب اسم شخص ثانٍ. نركز على عدد المشاركين والقطّة.</Text>
          <Text style={styles.label}>العدد الأقصى</Text>
          <TextInput value={capacity} onChangeText={setCapacity} style={styles.input} textAlign="right" keyboardType="number-pad" placeholder="20" />
          <Text style={styles.label}>القطّة للشخص — اختياري</Text>
          <TextInput value={shareAmount} onChangeText={setShareAmount} style={styles.input} textAlign="right" keyboardType="decimal-pad" placeholder="0" />
        </View> : null}

        <PrimaryButton label="إنشاء المناسبة والمتابعة" onPress={create} loading={busy} />
        <PrimaryButton label="رجوع" onPress={() => router.back()} secondary />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 44, gap: 11 },
  label: { color: theme.colors.ink, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 },
  choice: { width: "31.5%", minHeight: 86, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, alignItems: "center", justifyContent: "center", padding: 8 },
  choiceActive: { backgroundColor: theme.colors.burgundy, borderColor: theme.colors.burgundy },
  choiceIcon: { color: theme.colors.gold, fontSize: 22, marginBottom: 5 },
  choiceText: { color: theme.colors.ink, fontWeight: "800", fontSize: 12, textAlign: "center", writingDirection: "rtl" },
  choiceTextActive: { color: theme.colors.white },
  input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, borderRadius: 15, paddingHorizontal: 14, color: theme.colors.ink, writingDirection: "rtl" },
  row: { flexDirection: "row-reverse", gap: 10 },
  half: { flex: 1, gap: 8 },
  activityBox: { borderRadius: 22, padding: 16, backgroundColor: "#F1E5E1", gap: 9, marginVertical: 4 },
  activityTitle: { color: theme.colors.burgundy, fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  activityHelp: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 20 }
});
