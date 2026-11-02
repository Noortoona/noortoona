import React, { Suspense, lazy } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { BrandHeader, Card, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";
import BookingCheckout from "@/BookingCheckout";

const NativeCheckout = lazy(() => import("@/payments/CheckoutScreen"));

export default function PaymentRoute() {
  const auth = useAuth();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  if (auth.loading) return null;
  const enabled = process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === "true" && Constants.executionEnvironment !== "storeClient";
  if (enabled && auth.user?.role === "customer") return <Suspense fallback={<ActivityIndicator color={theme.colors.gold} />}><NativeCheckout /></Suspense>;
  return <BookingCheckout eventId={eventId} />;
}
