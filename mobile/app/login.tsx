import React, { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { ApiError } from "@/api";
import { homeByRole } from "@/roleGate";
import { PrimaryButton } from "@/ui";
import { theme } from "@/theme";
import { normalizeSaudiPhone, normalizeDigits } from "@/input";

export default function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [entry, setEntry] = useState("العملاء");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!auth.loading && auth.user) router.replace(homeByRole[auth.user.role] as never);
  }, [auth.loading, auth.user, router]);
  async function submit() {
    const normalizedPhone = normalizeSaudiPhone(phone);
    if (!normalizedPhone) { setError("أدخل رقم جوال سعودي صحيحًا."); return; }
    setError(""); setBusy(true);
    try {
      if (sent) await auth.verifyOtp(normalizedPhone, normalizeDigits(code));
      else { await auth.requestOtp(normalizedPhone); setSent(true); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "تعذر إكمال العملية"); }
    finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}><Image source={require("../assets/hala-logo.png")} style={styles.logoImage} resizeMode="contain" accessibilityLabel="HALA | هلا" /><Text style={styles.tagline}>لحظتك .. تبدأ بهلا</Text></View>
        <View style={styles.sheet}>
          <Text style={styles.title}>{sent ? "رمز التحقق" : `دخول ${entry}`}</Text>
          <View style={styles.entries}>{["العملاء", "الإدارة", "المشرفين", "الشركاء"].map(label => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: entry === label }} onPress={() => setEntry(label)} style={[styles.entry, entry === label && styles.entryActive]}><Text style={[styles.entryText, entry === label && styles.entryTextActive]}>{label}</Text></Pressable>)}</View>
          <Text style={styles.help}>{sent ? "أدخل الرمز المرسل إلى واتساب. صلاحيته ٥ دقائق." : "ادخل برقمك المسجل. تحدد صلاحيات حسابك اللوحة المتاحة لك."}</Text>
          <TextInput value={phone} onChangeText={value => { setPhone(value); setSent(false); setCode(""); }} placeholder="رقم الجوال" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" keyboardType="phone-pad" editable={!busy && !sent} accessibilityLabel="رقم الجوال" autoComplete="tel" />
          {sent ? <TextInput value={code} onChangeText={value => setCode(normalizeDigits(value))} placeholder="رمز التحقق المكون من ٦ أرقام" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp" accessibilityLabel="رمز التحقق" /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={sent ? "تأكيد والدخول" : "إرسال الرمز عبر واتساب"} onPress={submit} loading={busy} disabled={!normalizeSaudiPhone(phone) || (sent && code.length !== 6)} />
          {sent ? <PrimaryButton label="تغيير رقم الجوال" secondary onPress={() => { setSent(false); setCode(""); setError(""); }} disabled={busy} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.burgundyDeep },
  content: { flexGrow: 1, justifyContent: "flex-end" },
  brandBlock: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  logoImage: { width: 210, height: 120 },
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
