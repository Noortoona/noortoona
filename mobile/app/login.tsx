import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { ApiError } from "@/api";
import { homeByRole } from "@/roleGate";
import { PrimaryButton } from "@/ui";
import { theme } from "@/theme";

export default function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!auth.loading && auth.user) router.replace(homeByRole[auth.user.role] as never);
  }, [auth.loading, auth.user, router]);
  async function submit() {
    setError(""); setBusy(true);
    try {
      if (sent) await auth.verifyOtp(phone, code);
      else { await auth.requestOtp(phone); setSent(true); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "تعذر إكمال العملية"); }
    finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}><Text style={styles.logo}>هلا</Text><Text style={styles.tagline}>لحظتك تبدأ بهلا</Text></View>
        <View style={styles.sheet}>
          <Text style={styles.title}>{sent ? "رمز التحقق" : "أهلًا بك في هلا"}</Text>
          <Text style={styles.help}>{sent ? "أدخل الرمز المرسل إلى واتساب. صلاحيته ٥ دقائق." : "ادخل برقم جوالك، وسنوجهك تلقائيًا إلى حسابك."}</Text>
          <TextInput value={phone} onChangeText={value => { setPhone(value); setSent(false); setCode(""); }} placeholder="رقم الجوال" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" keyboardType="phone-pad" editable={!busy} />
          {sent ? <TextInput value={code} onChangeText={setCode} placeholder="رمز التحقق المكون من ٦ أرقام" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" keyboardType="number-pad" maxLength={6} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={sent ? "تأكيد والدخول" : "إرسال الرمز عبر واتساب"} onPress={submit} loading={busy} disabled={phone.replace(/\D/g, "").length < 9 || (sent && code.length !== 6)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.burgundyDeep },
  content: { flexGrow: 1, justifyContent: "flex-end" },
  brandBlock: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  logo: { color: theme.colors.gold, fontSize: 78, fontWeight: "900", writingDirection: "rtl" },
  tagline: { color: theme.colors.goldSoft, marginTop: 10, fontSize: 16, writingDirection: "rtl" },
  sheet: { backgroundColor: theme.colors.cream, borderTopLeftRadius: 34, borderTopRightRadius: 34, padding: 24, gap: 13 },
  title: { fontSize: 25, fontWeight: "900", color: theme.colors.ink, textAlign: "right", writingDirection: "rtl" },
  help: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 21 },
  input: { minHeight: 53, borderRadius: 15, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: 15, color: theme.colors.ink, writingDirection: "rtl" },
  error: { color: theme.colors.danger, textAlign: "right", writingDirection: "rtl", fontWeight: "700" }
});
