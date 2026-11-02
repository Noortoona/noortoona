import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { homeByRole } from "@/roleGate";
import { theme } from "@/theme";

export default function EntryScreen() {
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace((user ? homeByRole[user.role] : "/login") as never);
  }, [loading, user, router]);

  return (
    <View style={styles.wrap}>
      <View style={styles.mark}><Image source={require("../assets/hala-logo.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="هلا HALA" /><Text style={styles.tag}>لحظتك .. تبدأ بهلا</Text></View>
      <ActivityIndicator color={theme.colors.gold} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.burgundyDeep, alignItems: "center", justifyContent: "space-between", paddingVertical: 110 },
  mark: { alignItems: "center", marginTop: 80 },
  logo: { width: 240, height: 107 },
  tag: { marginTop: 12, color: theme.colors.goldSoft, fontSize: 15, writingDirection: "rtl" }
});
