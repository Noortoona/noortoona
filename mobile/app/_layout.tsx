import { useEffect } from "react";
import { track } from "@/prebooking";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/auth";
import { theme } from "@/theme";
import { LocaleProvider } from "@/i18n";

function RouteAnalytics() {
  const path = usePathname();
  useEffect(() => { void track("page_view", `/mobile${path.split("?")[0]}`); }, [path]);
  return null;
}
export default function RootLayout() {
  return (
    <LocaleProvider>
    <AuthProvider>
      <RouteAnalytics />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.cream } }} />
    </AuthProvider>
    </LocaleProvider>
  );
}
