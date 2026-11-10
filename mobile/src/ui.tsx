import React from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "./theme";
import { LanguageToggle, useI18n } from "./i18n";

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { isRTL } = useI18n();
  return <SafeAreaView style={[styles.screen, { direction: isRTL ? "rtl" : "ltr" }, style]} edges={["top", "left", "right"]}>{children}</SafeAreaView>;
}

export function BrandHeader({ title, subtitle, onLogout }: { title?: string; subtitle?: string; onLogout?: () => void }) {
  const { t, isRTL } = useI18n();
  const alignment = { textAlign: isRTL ? "right" as const : "left" as const, writingDirection: isRTL ? "rtl" as const : "ltr" as const };
  return (
    <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <View style={[styles.headerCopy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <Image source={require("../assets/hala-logo.png")} style={styles.brand} resizeMode="contain" accessibilityLabel="HALA | هلا" />
        {title ? <Text style={[styles.headerTitle, alignment]}>{t(title)}</Text> : null}
        {subtitle ? <Text style={[styles.headerSubtitle, alignment]}>{t(subtitle)}</Text> : null}
      </View>
      <View style={styles.headerControls}>
        <LanguageToggle />
        {onLogout ? <Pressable onPress={onLogout} style={styles.logout}><Text style={styles.logoutText}>{t("خروج")}</Text></Pressable> : null}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, loading, disabled, secondary }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean }) {
  const { t, isRTL } = useI18n();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t(label)} accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }} disabled={disabled || loading} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, (disabled || loading) && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color={secondary ? theme.colors.burgundy : theme.colors.white} /> : <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, { writingDirection: isRTL ? "rtl" : "ltr" }]}>{t(label)}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  const { t, isRTL } = useI18n();
  return (
    <View style={[styles.stat, accent && styles.statAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{typeof value === "string" ? t(value) : value}</Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}>{t(label)}</Text>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  const { t, isRTL } = useI18n();
  return <View style={styles.empty}><Text style={[styles.emptyTitle, { writingDirection: isRTL ? "rtl" : "ltr" }]}>{t(title)}</Text><Text style={[styles.emptyBody, { writingDirection: isRTL ? "rtl" : "ltr" }]}>{t(body)}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.cream },
  header: { paddingHorizontal: 20, paddingVertical: 18, flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between" },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  headerControls: { alignItems: "center", justifyContent: "flex-start", gap: 8, maxWidth: 156 },
  brand: { width: 132, height: 59 },
  headerTitle: { color: theme.colors.ink, fontSize: 24, fontWeight: "800", marginTop: 6, textAlign: "right", writingDirection: "rtl" },
  headerSubtitle: { color: theme.colors.muted, fontSize: 13, marginTop: 5, textAlign: "right", writingDirection: "rtl", lineHeight: 20 },
  logout: { borderWidth: 1, borderColor: theme.colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.paper },
  logoutText: { color: theme.colors.burgundy, fontWeight: "700" },
  button: { minHeight: 52, borderRadius: 16, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.burgundy },
  buttonSecondary: { backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.burgundy },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: theme.colors.white, fontSize: 16, fontWeight: "800", writingDirection: "rtl" },
  buttonTextSecondary: { color: theme.colors.burgundy },
  card: { backgroundColor: theme.colors.paper, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: theme.colors.line },
  stat: { width: "48.5%", minHeight: 106, padding: 16, borderRadius: 18, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line, justifyContent: "space-between" },
  statAccent: { backgroundColor: theme.colors.burgundy, borderColor: theme.colors.burgundy },
  statValue: { fontSize: 28, fontWeight: "900", color: theme.colors.ink, textAlign: "right" },
  statValueAccent: { color: theme.colors.white },
  statLabel: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", fontSize: 13 },
  statLabelAccent: { color: theme.colors.goldSoft },
  empty: { paddingVertical: 28, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink, writingDirection: "rtl" },
  emptyBody: { marginTop: 6, color: theme.colors.muted, textAlign: "center", writingDirection: "rtl", lineHeight: 21 }
});
