import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";
import { ActivityKey, OccasionKey, TemplateArtwork, templatesFor } from "@/templates";

const OCCASIONS: Array<{ key: OccasionKey; label: string; emoji: string; twoNames: boolean }> = [
  { key: "wedding", label: "زواج", emoji: "✦", twoNames: true },
  { key: "engagement", label: "ملكة / خطوبة", emoji: "♢", twoNames: true },
  { key: "graduation", label: "تخرج", emoji: "⌁", twoNames: false },
  { key: "birthday", label: "عيد ميلاد", emoji: "◌", twoNames: false },
  { key: "activity", label: "نشاط / تجمع", emoji: "⚡", twoNames: false },
  { key: "custom", label: "أخرى", emoji: "+", twoNames: false },
];

const ACTIVITIES: Array<{ key: ActivityKey; label: string }> = [
  { key: "padel", label: "بادل" },
  { key: "football", label: "كرة قدم" },
  { key: "camp", label: "كشتة" },
  { key: "chalet", label: "استراحة / شاليه" },
  { key: "trip", label: "رحلة" },
  { key: "dinner", label: "عشاء" },
  { key: "activityCustom", label: "نشاط مخصص" },
];

const PACKAGES = [
  { code: "start", name: "البداية", guests: "حتى 50 مدعو", price: 29 },
  { code: "basic", name: "الأساسية", guests: "حتى 200 مدعو", price: 99 },
  { code: "royal", name: "الملكية", guests: "حتى 500 مدعو", price: 149 },
] as const;

export default function CreateEvent() {
  const auth = useRequireRole("customer");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [occasionKey, setOccasionKey] = useState<OccasionKey>("wedding");
  const [activityKey, setActivityKey] = useState<ActivityKey>("padel");
  const [customActivity, setCustomActivity] = useState("");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [shareAmount, setShareAmount] = useState("");
  const [headline, setHeadline] = useState("هلا بضيوفك من أول دعوة");
  const [template, setTemplate] = useState("ليلة كحلية");
  const [packageCode, setPackageCode] = useState<(typeof PACKAGES)[number]["code"]>("basic");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => OCCASIONS.find(o => o.key === occasionKey)!, [occasionKey]);
  const activity = useMemo(() => ACTIVITIES.find(a => a.key === activityKey)!, [activityKey]);
  const currentTemplates = useMemo(() => templatesFor(occasionKey, activityKey), [occasionKey, activityKey]);
  const selectedTemplate = currentTemplates.find(t => t.name === template) || currentTemplates[0];

  if (auth.loading || !auth.user) return null;

  function chooseOccasion(key: OccasionKey) {
    setOccasionKey(key);
    setName2("");
    const first = templatesFor(key, activityKey)[0];
    if (first) setTemplate(first.name);
  }

  function chooseActivity(key: ActivityKey) {
    setActivityKey(key);
    const first = templatesFor("activity", key)[0];
    if (first) setTemplate(first.name);
  }

  function validateDetails() {
    if (!name1.trim()) return occasionKey === "activity" ? "اكتب اسم النشاط." : "اكتب الاسم.";
    if (selected.twoNames && !name2.trim()) return "هذا النوع يحتاج الاسمين.";
    if (!date.trim() || !time.trim() || !location.trim()) return "أكمل التاريخ والوقت والموقع.";
    if (occasionKey === "activity" && activityKey === "activityCustom" && !customActivity.trim()) return "اكتب نوع النشاط.";
    if (occasionKey === "activity" && Number(capacity || 0) < 1) return "أدخل عدد المشاركين.";
    return "";
  }

  async function create() {
    const error = validateDetails();
    if (error) return Alert.alert("أكمل البيانات", error);
    setBusy(true);
    try {
      const occasion = occasionKey === "wedding" ? "زواج" : occasionKey === "engagement" ? "ملكة / خطوبة" : occasionKey === "graduation" ? "تخرج" : occasionKey === "birthday" ? "عيد ميلاد" : occasionKey === "activity" ? "تجمع ونشاط" : "أخرى";
      const activityType = occasionKey === "activity" ? (activityKey === "activityCustom" ? customActivity.trim() : activity.label) : "";
      const pkg = PACKAGES.find(p => p.code === packageCode)!;
      const result = await api<{ event: { id: string } }>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          occasion,
          activityType,
          name1: name1.trim(),
          name2: selected.twoNames ? name2.trim() : "",
          title: occasionKey === "activity" ? name1.trim() : selected.twoNames ? `${occasion} ${name1.trim()} و ${name2.trim()}` : `${occasion} ${name1.trim()}`,
          date: date.trim(),
          time: time.trim(),
          location: location.trim(),
          capacity: occasionKey === "activity" ? Number(capacity || 0) : null,
          shareAmount: occasionKey === "activity" ? Number(shareAmount || 0) : 0,
          requireShareConsent: occasionKey === "activity" && Number(shareAmount || 0) > 0,
          allowNamedCompanions: occasionKey === "activity",
          waitlistEnabled: occasionKey === "activity",
          template: selectedTemplate.name,
          package: pkg.name,
          design: { occasionKey, activityKey, headline, accent: selectedTemplate.accent },
        }),
      }, auth.token);

      router.replace({
        pathname: "/customer/payment" as never,
        params: { eventId: result.event.id, package: packageCode },
      });
    } catch (e: any) {
      Alert.alert("تعذر إنشاء المناسبة", e?.message || "حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BrandHeader
        title={step === 1 ? "تفاصيل الدعوة" : step === 2 ? "اختر القالب" : "راجع واختر الباقة"}
        subtitle={`الخطوة ${step} من 3 — كل نوع دعوة له حقوله الخاصة`}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {[1, 2, 3].map(n => <View key={n} style={[styles.progressDot, n <= step && styles.progressDotActive]} />)}
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.label}>نوع الدعوة</Text>
            <View style={styles.grid}>
              {OCCASIONS.map(o => (
                <Pressable key={o.key} onPress={() => chooseOccasion(o.key)} style={[styles.choice, occasionKey === o.key && styles.choiceActive]}>
                  <Text style={styles.choiceIcon}>{o.emoji}</Text>
                  <Text style={[styles.choiceText, occasionKey === o.key && styles.choiceTextActive]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>

            {occasionKey === "activity" ? (
              <>
                <Text style={styles.label}>نوع النشاط</Text>
                <View style={styles.activityChoices}>
                  {ACTIVITIES.map(a => (
                    <Pressable key={a.key} onPress={() => chooseActivity(a.key)} style={[styles.activityChoice, activityKey === a.key && styles.activityChoiceActive]}>
                      <Text style={[styles.activityChoiceText, activityKey === a.key && styles.activityChoiceTextActive]}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {activityKey === "activityCustom" ? <TextInput value={customActivity} onChangeText={setCustomActivity} style={styles.input} textAlign="right" placeholder="اكتب نوع النشاط" /> : null}
              </>
            ) : null}

            <Text style={styles.label}>{occasionKey === "activity" ? "اسم النشاط" : occasionKey === "graduation" ? "اسم الخريج / الخريجة" : occasionKey === "birthday" ? "اسم صاحب المناسبة" : selected.twoNames ? "الاسم الأول" : "اسم المناسبة"}</Text>
            <TextInput value={name1} onChangeText={setName1} style={styles.input} textAlign="right" placeholder="اكتب هنا" />
            {selected.twoNames ? (
              <>
                <Text style={styles.label}>{occasionKey === "wedding" ? "اسم العروس / الطرف الثاني" : "الاسم الثاني"}</Text>
                <TextInput value={name2} onChangeText={setName2} style={styles.input} textAlign="right" placeholder="اكتب هنا" />
              </>
            ) : null}

            <View style={styles.row}>
              <View style={styles.half}><Text style={styles.label}>التاريخ</Text><TextInput value={date} onChangeText={setDate} style={styles.input} textAlign="right" placeholder="2026-12-20" /></View>
              <View style={styles.half}><Text style={styles.label}>الوقت</Text><TextInput value={time} onChangeText={setTime} style={styles.input} textAlign="right" placeholder="20:30" /></View>
            </View>
            <Text style={styles.label}>الموقع</Text>
            <TextInput value={location} onChangeText={setLocation} style={styles.input} textAlign="right" placeholder="اسم القاعة أو الموقع" />

            {occasionKey === "activity" ? (
              <View style={styles.activityBox}>
                <Text style={styles.activityTitle}>إعدادات النشاط</Text>
                <Text style={styles.activityHelp}>لا يوجد اسم شخص ثانٍ هنا. نركز على المشاركين والقطّة وقائمة الانتظار.</Text>
                <Text style={styles.label}>العدد الأقصى</Text>
                <TextInput value={capacity} onChangeText={setCapacity} style={styles.input} textAlign="right" keyboardType="number-pad" placeholder="20" />
                <Text style={styles.label}>القطّة للشخص — اختياري</Text>
                <TextInput value={shareAmount} onChangeText={setShareAmount} style={styles.input} textAlign="right" keyboardType="decimal-pad" placeholder="0" />
              </View>
            ) : null}

            <PrimaryButton label="التالي: اختيار القالب" onPress={() => {
              const error = validateDetails();
              if (error) Alert.alert("أكمل البيانات", error);
              else setStep(2);
            }} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.sectionTitle}>اختر الشكل المناسب</Text>
            <Text style={styles.help}>القوالب المعروضة مخصصة لنوع دعوتك الحالي.</Text>
            <View style={styles.templateGrid}>
              {currentTemplates.map(t => (
                <Pressable key={t.name} onPress={() => setTemplate(t.name)} style={styles.templateCard}>
                  <TemplateArtwork template={t} label={occasionKey === "activity" ? activity.label : selected.label} selected={template === t.name} />
                  <Text style={styles.templateName}>{t.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>العبارة الرئيسية</Text>
            <TextInput value={headline} onChangeText={setHeadline} style={styles.input} textAlign="right" maxLength={70} />
            <View style={styles.actions}><PrimaryButton label="التالي: الباقة" onPress={() => setStep(3)} /><PrimaryButton label="رجوع" onPress={() => setStep(1)} secondary /></View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={styles.previewCard}>
              <TemplateArtwork template={selectedTemplate} label={occasionKey === "activity" ? activity.label : selected.label} selected />
              <Text style={styles.previewTitle}>{headline}</Text>
              <Text style={styles.previewNames}>{selected.twoNames ? `${name1} و ${name2}` : name1}</Text>
              <Text style={styles.previewMeta}>{date} • {time} • {location}</Text>
            </View>

            <Text style={styles.sectionTitle}>اختر الباقة</Text>
            {PACKAGES.map(p => (
              <Pressable key={p.code} onPress={() => setPackageCode(p.code)} style={[styles.package, packageCode === p.code && styles.packageActive]}>
                <View style={styles.packageCopy}><Text style={[styles.packageName, packageCode === p.code && styles.packageNameActive]}>{p.name}</Text><Text style={[styles.packageGuests, packageCode === p.code && styles.packageGuestsActive]}>{p.guests}</Text></View>
                <Text style={[styles.price, packageCode === p.code && styles.priceActive]}>{p.price} ر.س</Text>
              </Pressable>
            ))}
            <Text style={styles.trial}>قبل الدفع لديك إرسال تجريبي مجاني واحد للتأكد من شكل الدعوة ووصولها.</Text>
            <PrimaryButton label="إنشاء المناسبة والمتابعة للدفع" onPress={create} loading={busy} />
            <PrimaryButton label="رجوع للقالب" onPress={() => setStep(2)} secondary />
          </>
        ) : null}

        {step === 1 ? <PrimaryButton label="إلغاء" onPress={() => router.back()} secondary /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 44, gap: 11 },
  progress: { flexDirection: "row-reverse", justifyContent: "center", gap: 8, marginBottom: 4 },
  progressDot: { width: 46, height: 5, borderRadius: 4, backgroundColor: theme.colors.line },
  progressDotActive: { backgroundColor: theme.colors.gold },
  label: { color: theme.colors.ink, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 },
  choice: { width: "31.5%", minHeight: 86, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, alignItems: "center", justifyContent: "center", padding: 8 },
  choiceActive: { backgroundColor: theme.colors.burgundy, borderColor: theme.colors.burgundy },
  choiceIcon: { color: theme.colors.gold, fontSize: 22, marginBottom: 5 },
  choiceText: { color: theme.colors.ink, fontWeight: "800", fontSize: 12, textAlign: "center", writingDirection: "rtl" },
  choiceTextActive: { color: theme.colors.white },
  activityChoices: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  activityChoice: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line },
  activityChoiceActive: { backgroundColor: theme.colors.burgundy },
  activityChoiceText: { color: theme.colors.ink, fontWeight: "700", writingDirection: "rtl" },
  activityChoiceTextActive: { color: theme.colors.white },
  input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, borderRadius: 15, paddingHorizontal: 14, color: theme.colors.ink, writingDirection: "rtl" },
  row: { flexDirection: "row-reverse", gap: 10 },
  half: { flex: 1, gap: 8 },
  activityBox: { borderRadius: 22, padding: 16, backgroundColor: "#F1E5E1", gap: 9, marginVertical: 4 },
  activityTitle: { color: theme.colors.burgundy, fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  activityHelp: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 20 },
  sectionTitle: { color: theme.colors.ink, fontSize: 22, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  help: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 20 },
  templateGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  templateCard: { width: "48%" },
  templateName: { color: theme.colors.ink, textAlign: "right", writingDirection: "rtl", fontWeight: "800", marginTop: 7 },
  actions: { gap: 9, marginTop: 5 },
  previewCard: { borderRadius: 24, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line, padding: 14, gap: 8 },
  previewTitle: { color: theme.colors.gold, fontWeight: "900", textAlign: "center", writingDirection: "rtl", fontSize: 17 },
  previewNames: { color: theme.colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center", writingDirection: "rtl" },
  previewMeta: { color: theme.colors.muted, textAlign: "center", writingDirection: "rtl" },
  package: { minHeight: 80, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, padding: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  packageActive: { backgroundColor: theme.colors.burgundy, borderColor: theme.colors.gold },
  packageCopy: { alignItems: "flex-end" },
  packageName: { color: theme.colors.ink, fontSize: 17, fontWeight: "900", writingDirection: "rtl" },
  packageNameActive: { color: theme.colors.white },
  packageGuests: { color: theme.colors.muted, marginTop: 4, writingDirection: "rtl" },
  packageGuestsActive: { color: theme.colors.goldSoft },
  price: { color: theme.colors.burgundy, fontSize: 20, fontWeight: "900", writingDirection: "rtl" },
  priceActive: { color: theme.colors.gold },
  trial: { color: theme.colors.success, textAlign: "right", writingDirection: "rtl", fontWeight: "700", lineHeight: 21, padding: 12, backgroundColor: "#EAF5EF", borderRadius: 14 },
});
