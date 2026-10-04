import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/auth";
import { ApiError } from "@/api";
import { homeByRole } from "@/roleGate";
import { PrimaryButton } from "@/ui";
import { theme } from "@/theme";
import { BrandLogo } from "@/BrandLogo";

export default function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.loading && auth.user) router.replace(homeByRole[auth.user.role] as never);
  }, [auth.loading, auth.user, router]);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await auth.signIn(email, password);
      else await auth.register({ name, phone, email, password });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر إكمال العملية");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <BrandLogo width={230} />
          <Text style={styles.tagline}>لحظتك تبدأ بهلا</Text>
        </View>
        <View style={styles.sheet}>
          <View style={styles.tabs}>
            <Pressable onPress={() => setMode("login")} style={[styles.tab, mode === "login" && styles.tabActive]}><Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>تسجيل الدخول</Text></Pressable>
            <Pressable onPress={() => setMode("register")} style={[styles.tab, mode === "register" && styles.tabActive]}><Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>حساب جديد</Text></Pressable>
          </View>
          <Text style={styles.title}>{mode === "login" ? "مرحبًا بعودتك" : "ابدأ مع هلا"}</Text>
          <Text style={styles.help}>{mode === "login" ? "العميل والمشرف والأدمن يدخلون من نفس الشاشة." : "التسجيل الذاتي ينشئ حساب عميل. المشرف ينشئه الأدمن."}</Text>

          {mode === "register" ? <>
            <TextInput value={name} onChangeText={setName} placeholder="الاسم" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" />
            <TextInput value={phone} onChangeText={setPhone} placeholder="رقم الجوال" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" keyboardType="phone-pad" />
          </> : null}
          <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" autoCapitalize="none" keyboardType="email-address" />
          <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور" placeholderTextColor="#9B8C91" style={styles.input} textAlign="right" secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={mode === "login" ? "دخول إلى هلا" : "إنشاء حساب العميل"} onPress={submit} loading={busy} disabled={!email || password.length < 8 || (mode === "register" && !name)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.burgundyDeep },
  content: { flexGrow: 1, justifyContent: "flex-end" },
  brandBlock: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  tagline: { color: theme.colors.goldSoft, marginTop: 10, fontSize: 16, writingDirection: "rtl" },
  sheet: { backgroundColor: theme.colors.cream, borderTopLeftRadius: 34, borderTopRightRadius: 34, padding: 24, gap: 13 },
  tabs: { flexDirection: "row-reverse", backgroundColor: "#EEE2D8", padding: 4, borderRadius: 16 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 13, alignItems: "center" },
  tabActive: { backgroundColor: theme.colors.paper },
  tabText: { color: theme.colors.muted, fontWeight: "700", writingDirection: "rtl" },
  tabTextActive: { color: theme.colors.burgundy },
  title: { fontSize: 25, fontWeight: "900", color: theme.colors.ink, textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  help: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 21, marginBottom: 4 },
  input: { minHeight: 53, borderRadius: 15, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: 15, color: theme.colors.ink, writingDirection: "rtl" },
  error: { color: theme.colors.danger, textAlign: "right", writingDirection: "rtl", fontWeight: "700" }
});
