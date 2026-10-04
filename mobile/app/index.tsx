import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
      <View style={styles.mark}><Text style={styles.logo}>هلا</Text><Text style={styles.tag}>هلا بضيوفك من أول دعوة</Text></View>
      <ActivityIndicator color={theme.colors.gold} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.burgundyDeep, alignItems: "center", justifyContent: "space-between", paddingVertical: 110 },
  mark: { alignItems: "center", marginTop: 80 },
  logo: { color: theme.colors.gold, fontSize: 72, fontWeight: "900", writingDirection: "rtl" },
  tag: { marginTop: 12, color: theme.colors.goldSoft, fontSize: 15, writingDirection: "rtl" }
});
