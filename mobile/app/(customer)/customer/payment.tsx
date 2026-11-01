import React, { Suspense, lazy } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";

const NativeCheckout = lazy(() => import("@/payments/CheckoutScreen"));

export default function PaymentRoute() {
  const auth = useRequireRole("customer");
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  if (auth.loading || !auth.user) return null;
  const enabled = process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === "true" && Constants.executionEnvironment !== "storeClient";
  if (enabled) return <Suspense fallback={<ActivityIndicator color={theme.colors.gold} />}><NativeCheckout /></Suspense>;
  return <Screen><BrandHeader title="الباقات والتجربة" subtitle="الدفع معطّل في النسخة التجريبية" /><View style={{ padding: 20, gap: 14 }}><Card><Text style={{ color: theme.colors.ink, textAlign: "right", lineHeight: 24 }}>يمكنك إنشاء المناسبة وإدارة الضيوف وتجربة دعوة واحدة وفق سياسة الاستخدام. سيُفعّل الدفع بعد مراجعة النسخة وتجهيز متطلباته.</Text></Card><PrimaryButton label="فتح المناسبة وتجربتها" onPress={() => eventId ? router.replace({ pathname: "/customer/event/[id]" as never, params: { id: eventId } }) : router.replace("/customer" as never)} /><PrimaryButton label="رجوع" onPress={() => router.back()} secondary /></View></Screen>;
}
