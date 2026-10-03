import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/auth";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor={theme.colors.burgundyDeep} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.cream } }} />
    </AuthProvider>
  );
}
