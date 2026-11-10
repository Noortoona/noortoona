import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { ApiError } from "@/api";
import { homeByRole } from "@/roleGate";
import { PrimaryButton } from "@/ui";
import { theme } from "@/theme";
import { LanguageToggle, useI18n } from "@/i18n";
import { normalizeSaudiPhone, normalizeDigits, normalizeAdminEmail } from "@/input";

export default function LoginScreen() {
  const auth = useAuth();
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const [entry, setEntry] = useState("العملاء");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [useEmail, setUseEmail] = useState(true);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isStaff = entry === "الإدارة" || entry === "خدمة العملاء";
  const emailMode = isStaff && useEmail;
  const validEmail = normalizeAdminEmail(email);
  const validPhone = normalizeSaudiPhone(phone);
  const validCode = /^\d{6}$/.test(normalizeDigits(code));
  function resetStep() { setSent(false); setCode(""); setError(""); }
  function changeEntry(label: string) { setEntry(label); setUseEmail(true); resetStep(); }
  useEffect(() => {
    if (!auth.loading && auth.user) router.replace(homeByRole[auth.user.role] as never);
  }, [auth.loading, auth.user, router]);
  async function submit() {
    if (emailMode ? !validEmail : !validPhone) {
      setError(t(emailMode ? "أدخل بريدًا إلكترونيًا صحيحًا." : "أدخل رقم جوال سعودي صحيحًا."));
      return;
    }
    setError(""); setBusy(true);
    try {
      if (emailMode) {
        if (sent) await auth.verifyAdminEmailOtp(validEmail!, normalizeDigits(code));
        else { await auth.requestAdminEmailOtp(validEmail!); setSent(true); }
      } else if (sent) await auth.verifyOtp(validPhone!, normalizeDigits(code));
      else { await auth.requestOtp(validPhone!); setSent(true); }
    } catch (e) { setError(e instanceof ApiError ? e.message : t("تعذر إكمال العملية")); }
    finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.languageRow}><LanguageToggle /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}><Image source={require("../assets/hala-logo.png")} style={styles.logoImage} resizeMode="contain" accessibilityLabel="HALA | هلا" /><Text style={styles.tagline}>{t("لحظتك .. تبدأ بهلا")}</Text></View>
        <View style={styles.sheet}><PrimaryButton label="الباقات والأسعار" secondary onPress={()=>router.push("/packages" as never)}/><PrimaryButton label="كن من أوائل عملاء هلا" secondary onPress={() => router.push("/launch" as never)} /><PrimaryButton label="تصفح واحجز دون تسجيل دخول" secondary onPress={() => router.push("/customer/create" as never)} /><PrimaryButton label="متابعة حجزي الأخير" secondary onPress={() => { void SecureStore.getItemAsync("hala.booking.last").then(id => id ? router.push({pathname:"/customer/bookings" as never,params:{id}}) : router.push("/customer/create" as never)); }} />
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{sent ? t("رمز التحقق") : t("دخول " + entry)}</Text>
          <View style={[styles.entries, { flexDirection: isRTL ? "row-reverse" : "row" }]}>{["العملاء", "الإدارة", "المشرفين", "الشركاء", "خدمة العملاء"].map(label => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: entry === label }} onPress={() => changeEntry(label)} style={[styles.entry, entry === label && styles.entryActive]}><Text style={[styles.entryText, entry === label && styles.entryTextActive]}>{t(label)}</Text></Pressable>)}</View>
          <Text style={[styles.help, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>
            {t(sent
              ? emailMode ? "أدخل الرمز المرسل إلى البريد الإلكتروني. صلاحيته ٥ دقائق." : "أدخل رمز واتساب. صلاحيته ٥ دقائق."
              : emailMode ? "أدخل البريد المعتمد للإدارة. لا يتطلب اشتراك واتساب." : "ادخل برقمك المسجل. تحدد صلاحيات حسابك اللوحة المتاحة لك.")}
          </Text>
          {emailMode
            ? <TextInput value={email} onChangeText={value => { setEmail(value); resetStep(); }}
                placeholder={t("البريد الإلكتروني للإدارة")} placeholderTextColor="#9B8C91"
                style={styles.input} textAlign="left" keyboardType="email-address" autoCapitalize="none"
                autoComplete="email" textContentType="emailAddress" editable={!busy && !sent}
                accessibilityLabel={t("البريد الإلكتروني للإدارة")} />
            : <TextInput value={phone} onChangeText={value => { setPhone(value); resetStep(); }}
                placeholder={t("رقم الجوال")} placeholderTextColor="#9B8C91" style={styles.input}
                textAlign={isRTL ? "right" : "left"} keyboardType="phone-pad" editable={!busy && !sent}
                accessibilityLabel={t("رقم الجوال")} autoComplete="tel" />}
          {sent ? <TextInput value={code} onChangeText={value => setCode(normalizeDigits(value))}
              placeholder={t("رمز التحقق المكون من ٦ أرقام")} placeholderTextColor="#9B8C91"
              style={styles.input} textAlign={isRTL ? "right" : "left"} keyboardType="number-pad" maxLength={6}
              textContentType="oneTimeCode" autoComplete={emailMode ? "off" : "sms-otp"}
              accessibilityLabel={t("رمز التحقق")} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={sent ? "تأكيد والدخول" : emailMode ? "إرسال الرمز إلى البريد" : "إرسال الرمز عبر واتساب"}
            onPress={submit} loading={busy} disabled={(emailMode ? !validEmail : !validPhone) || (sent && !validCode)} />
          {sent ? <PrimaryButton label={emailMode ? "تغيير البريد" : "تغيير رقم الجوال"}
            secondary onPress={resetStep} disabled={busy} /> : null}
          {isStaff ? <PrimaryButton
            label={emailMode ? "الدخول برقم الجوال بدل البريد" : "الدخول بالبريد الإلكتروني"}
            secondary disabled={busy}
            onPress={() => { setUseEmail(!useEmail); resetStep(); }} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.burgundyDeep },
  content: { flexGrow: 1, justifyContent: "flex-end" },
  brandBlock: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  logoImage: { width: 240, height: 107 },
  languageRow: { position: "absolute", top: 48, right: 16, zIndex: 5 },
  entries: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  entry: { borderWidth: 1, borderColor: theme.colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  entryActive: { backgroundColor: theme.colors.burgundy, borderColor: theme.colors.burgundy },
  entryText: { color: theme.colors.burgundy, fontWeight: "700" },
  entryTextActive: { color: theme.colors.white },
  logo: { color: theme.colors.gold, fontSize: 78, fontWeight: "900", writingDirection: "rtl" },
  tagline: { color: theme.colors.goldSoft, marginTop: 10, fontSize: 16, writingDirection: "rtl" },
  sheet: { backgroundColor: theme.colors.cream, borderTopLeftRadius: 34, borderTopRightRadius: 34, padding: 24, gap: 13 },
  title: { fontSize: 25, fontWeight: "900", color: theme.colors.ink, textAlign: "right", writingDirection: "rtl" },
  help: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 21 },
  input: { minHeight: 53, borderRadius: 15, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: 15, color: theme.colors.ink, writingDirection: "rtl" },
  error: { color: theme.colors.danger, textAlign: "right", writingDirection: "rtl", fontWeight: "700" }
});
