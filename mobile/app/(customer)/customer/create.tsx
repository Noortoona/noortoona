import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";
import { isGoogleMapsUrl } from "@/links";
import { occasionForApi } from "@/templateCatalog";
import { audioDataUri, imageDataUri, MAX_AUDIO_BYTES } from "@/designMedia";
import { InvitationPreview } from "@/InvitationPreview";
import { ActivityKey, OccasionKey, TemplateArtwork, templatesFor } from "@/templates";

const OCCASIONS: Array<{ key: OccasionKey; label: string; emoji: string; twoNames: boolean }> = [
  { key: "wedding", label: "زواج", emoji: "✦", twoNames: true },
  { key: "milkah", label: "ملكة / عقد قران", emoji: "✧", twoNames: true },
  { key: "engagement", label: "خطوبة", emoji: "♢", twoNames: true },
  { key: "graduation", label: "تخرج", emoji: "⌁", twoNames: false },
  { key: "birthday", label: "عيد ميلاد", emoji: "◌", twoNames: false },
  { key: "newborn", label: "مولود", emoji: "✷", twoNames: false },
  { key: "meeting", label: "اجتماع", emoji: "▣", twoNames: false },
  { key: "conference", label: "مؤتمر", emoji: "◇", twoNames: false },
  { key: "formal", label: "مناسبة رسمية", emoji: "▤", twoNames: false },
  { key: "opening", label: "افتتاح", emoji: "✂", twoNames: false },
  { key: "honoring", label: "تكريم", emoji: "♛", twoNames: false },
  { key: "national", label: "مناسبة وطنية", emoji: "✦", twoNames: false },
  { key: "condolence", label: "عزاء", emoji: "❧", twoNames: false },
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
  { code: "hala_basic", name: "هلا الأساسية", guests: "حتى 100 مدعو", price: 149 },
  { code: "hala_plus", name: "هلا بلس", guests: "حتى 250 مدعو", price: 349 },
  { code: "hala_premium", name: "هلا بريميوم", guests: "حتى 500 مدعو", price: 699 },
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
  const [mapsUrl, setMapsUrl] = useState("");
  const [occasionDetails, setOccasionDetails] = useState("");
  const [capacity, setCapacity] = useState("");
  const [shareAmount, setShareAmount] = useState("");
  const [headline, setHeadline] = useState("لحظتك .. تبدأ بهلا");
  const [message, setMessage] = useState("وجودكم يكمل فرحتنا");
  const [font, setFont] = useState("ruqaa");
  const [accent, setAccent] = useState("#E3BD64");
  const [image, setImage] = useState("");
  const [audio, setAudio] = useState("");
  const [audioName, setAudioName] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [template, setTemplate] = useState("ليلة كحلية");
  const [packageCode, setPackageCode] = useState<(typeof PACKAGES)[number]["code"]>("hala_plus");
  const [requestSupervisor, setRequestSupervisor] = useState(false);
  const [supervisorPrice, setSupervisorPrice] = useState(299);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => OCCASIONS.find(o => o.key === occasionKey)!, [occasionKey]);
  const activity = useMemo(() => ACTIVITIES.find(a => a.key === activityKey)!, [activityKey]);
  const currentTemplates = useMemo(() => templatesFor(occasionKey, activityKey), [occasionKey, activityKey]);
  const selectedTemplate = currentTemplates.find(t => t.name === template) || currentTemplates[0];
  useEffect(() => { api<{ supervisorAddonSar: number }>("/api/pricing/quote").then(result => setSupervisorPrice(result.supervisorAddonSar)).catch(() => undefined); }, []);

  if (auth.loading || !auth.user) return null;

  async function pickImage() {
    setMediaBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.6, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error("تعذر قراءة الصورة. اختر صورة أخرى.");
      setImage(imageDataUri(asset.base64));
    } catch (error) { Alert.alert("الصورة", error instanceof Error ? error.message : "تعذر فتح الصور."); }
    finally { setMediaBusy(false); }
  }

  async function pickAudio() {
    setMediaBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = new File(asset.uri);
      try {
        if ((asset.size ?? file.size) > MAX_AUDIO_BYTES) throw new Error("اختر ملف صوت لا يتجاوز 600 كيلوبايت.");
        setAudio(audioDataUri(await file.base64(), asset.mimeType, asset.name));
        setAudioName(asset.name);
      } finally { try { file.delete(); } catch {} }
    } catch (error) { Alert.alert("موسيقى الدعوة", error instanceof Error ? error.message : "تعذر فتح الملف."); }
    finally { setMediaBusy(false); }
  }

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
    if (mapsUrl.trim() && !isGoogleMapsUrl(mapsUrl.trim())) return "أدخل رابط Google Maps صحيحًا يبدأ بـ https://.";
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
      const occasion = occasionForApi(occasionKey, selected.label);
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
          mapsUrl: mapsUrl.trim(),
          description: occasionDetails.trim(),
          message: message.trim(),
          capacity: occasionKey === "activity" ? Number(capacity || 0) : null,
          shareAmount: occasionKey === "activity" ? Number(shareAmount || 0) : 0,
          requireShareConsent: occasionKey === "activity" && Number(shareAmount || 0) > 0,
          allowNamedCompanions: occasionKey === "activity",
          waitlistEnabled: occasionKey === "activity",
          template: selectedTemplate.name,
          package: pkg.name,
          requestSupervisor,
          design: { occasionKey, activityKey, headline, accent, font, image, audio },
        }),
      }, auth.token);

      router.replace({
        pathname: "/customer/event/[id]" as never,
        params: { id: result.event.id },
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
            <TextInput value={mapsUrl} onChangeText={setMapsUrl} style={styles.input} textAlign="right" placeholder="رابط Google Maps (اختياري)" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
            {(["meeting", "conference", "formal"] as OccasionKey[]).includes(occasionKey) ? <><Text style={styles.label}>{occasionKey === "meeting" ? "جدول الأعمال" : occasionKey === "conference" ? "محاور المؤتمر والمتحدثون" : "تفاصيل المناسبة الرسمية"}</Text><TextInput value={occasionDetails} onChangeText={setOccasionDetails} style={styles.input} textAlign="right" multiline placeholder="التفاصيل الخاصة بهذا النوع" /></> : null}

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
            <Text style={styles.label}>نص الدعوة</Text>
            <TextInput value={message} onChangeText={setMessage} style={styles.input} textAlign="right" multiline maxLength={1000} />
            <Text style={styles.label}>الخط</Text>
            <View style={styles.activityChoices}>{[{ key: "ruqaa", label: "رقعة" }, { key: "tajawal", label: "تجوال" }, { key: "serif", label: "كلاسيكي" }].map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: font === option.key }} onPress={() => setFont(option.key)} style={[styles.activityChoice, font === option.key && styles.activityChoiceActive]}><Text style={[styles.activityChoiceText, font === option.key && styles.activityChoiceTextActive]}>{option.label}</Text></Pressable>)}</View>
            <Text style={styles.label}>اللون الرئيسي</Text>
            <View style={styles.activityChoices}>{["#E3BD64", "#651D32", "#9A7434", "#246A4A", "#FFFFFF"].map(color => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`اختيار اللون ${color}`} accessibilityState={{ selected: accent === color }} onPress={() => setAccent(color)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: color, borderWidth: accent === color ? 4 : 1, borderColor: theme.colors.ink }} />)}</View>
            <PrimaryButton label={image ? "تغيير الصورة / التصميم" : "رفع صورة أو تصميم خاص"} onPress={pickImage} loading={mediaBusy} secondary />
            {image ? <><Image source={{ uri: image }} style={{ width: "100%", height: 220, borderRadius: 14 }} resizeMode="cover" /><PrimaryButton label="إزالة الصورة" onPress={() => setImage("")} secondary /></> : null}
            <PrimaryButton label={audio ? "تغيير موسيقى الدعوة" : "إضافة موسيقى (حتى 600 كيلوبايت)"} onPress={pickAudio} loading={mediaBusy} secondary />
            {audio ? <><Text style={styles.help}>{audioName} — يبدأ تشغيل الصوت باختيار الضيف.</Text><PrimaryButton label="إزالة الموسيقى" onPress={() => { setAudio(""); setAudioName(""); }} secondary /></> : null}
            <Text style={styles.help}>تُحفظ الصورة والموسيقى ضمن تصميم الدعوة. استخدم ملفات تملك حق مشاركتها.</Text>
            <View style={styles.actions}><PrimaryButton label="التالي: الباقة" onPress={() => setStep(3)} /><PrimaryButton label="رجوع" onPress={() => setStep(1)} secondary /></View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <InvitationPreview data={{ occasionKey, activityKey, occasion: occasionForApi(occasionKey, selected.label), activityType: occasionKey === "activity" ? (activityKey === "activityCustom" ? customActivity : activity.label) : "", name1, name2, date, time, location, message, template: selectedTemplate.name, design: { headline, accent, font, image, audio } }} />

            <Text style={styles.sectionTitle}>اختر الباقة</Text>
            {PACKAGES.map(p => (
              <Pressable key={p.code} onPress={() => setPackageCode(p.code)} style={[styles.package, packageCode === p.code && styles.packageActive]}>
                <View style={styles.packageCopy}><Text style={[styles.packageName, packageCode === p.code && styles.packageNameActive]}>{p.name}</Text><Text style={[styles.packageGuests, packageCode === p.code && styles.packageGuestsActive]}>{p.guests}</Text></View>
                <Text style={[styles.price, packageCode === p.code && styles.priceActive]}>{p.price} ر.س</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setRequestSupervisor(value => !value)} style={[styles.package, requestSupervisor && styles.packageActive]} accessibilityRole="checkbox" accessibilityState={{ checked: requestSupervisor }}>
              <Text style={[styles.packageName, requestSupervisor && styles.packageNameActive]}>{requestSupervisor ? "☑" : "□"} إضافة مشرف للمناسبة</Text>
              <Text style={[styles.price, requestSupervisor && styles.priceActive]}>+{supervisorPrice} ر.س</Text>
            </Pressable>
            <Text style={styles.trial}>الإجمالي: {PACKAGES.find(p => p.code === packageCode)!.price + (requestSupervisor ? supervisorPrice : 0)} ر.س</Text>
            <Text style={styles.trial}>قبل الدفع لديك إرسال تجريبي مجاني واحد للتأكد من شكل الدعوة ووصولها.</Text>
            <PrimaryButton label="إنشاء المناسبة وتجربتها" onPress={create} loading={busy} disabled={mediaBusy} />
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
