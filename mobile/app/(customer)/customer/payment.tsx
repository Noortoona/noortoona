import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ApplePay,
  ApplePayConfig,
  CreditCard,
  CreditCardConfig,
  GeneralError,
  NetworkEndpointError,
  NetworkError,
  PaymentConfig,
  PaymentResponse,
  PaymentStatus,
  StcPay,
  TokenResponse,
  UnexpectedError,
  type PaymentResult,
} from "react-native-moyasar-sdk";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, Card, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";

type Package = { code: string; name: string; guestLimit: number; amount: number; amountSar: number; currency: string };
type Order = { id: string; package_code: string; amount: number; currency: string; status: string };
type Billing = {
  packages: Package[];
  payment: Order | null;
  guestCount: number;
  freeTestUsed: boolean;
  paymentConfigured: boolean;
  supervisorAddonAmount: number;
  features: { applePay: { enabled: boolean; merchantId?: string | null }; stcPay: { enabled: boolean }; card: { enabled: boolean } };
};
type Checkout = { order: Order; publishableKey: string; features: { applePay: { enabled: boolean; merchantId?: string | null }; stcPay: { enabled: boolean } } };
type ReferralQuote = { code: string; kind: string; discountAmount: number; discountedPackageAmount: number };

export default function PaymentScreen() {
  const auth = useRequireRole("customer");
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId: string; package?: string }>();
  const eventId = String(params.eventId || "");
  const [billing, setBilling] = useState<Billing | null>(null);
  const [selected, setSelected] = useState(String(params.package || "basic"));
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referral, setReferral] = useState<ReferralQuote | null>(null);

  const load = useCallback(async () => {
    if (!auth.token || !eventId) return;
    try {
      const data = await api<Billing>(`/api/payments/order?eventId=${encodeURIComponent(eventId)}`, {}, auth.token);
      setBilling(data);
      if (data.payment?.package_code && data.payment.status !== "paid") setSelected(data.payment.package_code);
      if (data.payment?.status === "paid") setCheckout(null);
    } catch (e: any) {
      Alert.alert("تعذر تحميل الدفع", e?.message || "حاول مرة أخرى");
    }
  }, [auth.token, eventId]);

  useEffect(() => { load(); }, [load]);

  const config = useMemo(() => {
    if (!checkout?.publishableKey) return null;
    const merchantId = checkout.features.applePay.merchantId || process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID || "";
    return new PaymentConfig({
      givenId: checkout.order.id,
      publishableApiKey: checkout.publishableKey,
      amount: checkout.order.amount,
      currency: checkout.order.currency || "SAR",
      merchantCountryCode: "SA",
      description: `Hala invitation package ${checkout.order.package_code}`,
      metadata: { event_id: eventId, order_id: checkout.order.id, package_code: checkout.order.package_code },
      supportedNetworks: ["mada", "visa", "mastercard"],
      creditCard: new CreditCardConfig({ saveCard: false, manual: false }),
      applePay: merchantId ? new ApplePayConfig({ merchantId, label: "هلا", manual: false, saveCard: false }) : undefined,
    });
  }, [checkout, eventId]);

  if (auth.loading || !auth.user) return null;
  const paid = billing?.payment?.status === "paid";

  async function applyReferral() {
    const code = referralCode.trim().toUpperCase();
    if (!code) { setReferral(null); setCheckout(null); return; }
    try {
      const result = await api<ReferralQuote>(`/api/referrals/quote?code=${encodeURIComponent(code)}&package=${encodeURIComponent(selected)}`, {}, auth.token);
      setReferral(result); setReferralCode(result.code); setCheckout(null);
    } catch (e: any) { setReferral(null); setCheckout(null); Alert.alert("الكود غير متاح", e?.message || "تحقق من الكود"); }
  }

  async function prepare(forceNew = false) {
    if (!billing?.paymentConfigured) {
      return Alert.alert("الدفع غير مفعّل بعد", "تم تجهيز التكامل، ويلزم إضافة مفاتيح Moyasar التجريبية في Netlify قبل أول عملية.");
    }
    setBusy(true);
    try {
      const result = await api<Checkout>("/api/payments/order", {
        method: "POST",
        body: JSON.stringify({ eventId, packageCode: selected, forceNew, referralCode: referral?.code || "" }),
      }, auth.token);
      setCheckout(result);
    } catch (e: any) {
      Alert.alert("تعذر تجهيز الدفع", e?.message || "حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  async function verify(orderId: string) {
    setVerifying(true);
    try {
      const result = await api<any>("/api/payments/verify", { method: "POST", body: JSON.stringify({ orderId }) }, auth.token);
      if (result.paid) {
        await load();
        Alert.alert("تم الدفع ✓", "تم تفعيل باقة هلا ويمكنك الآن إرسال الدعوات للضيوف.", [
          { text: "فتح المناسبة", onPress: () => router.replace({ pathname: "/customer/event/[id]" as never, params: { id: eventId } }) },
        ]);
      } else {
        Alert.alert("لم يكتمل الدفع", "حالة العملية: " + (result.status || "بانتظار التأكيد"));
      }
    } catch (e: any) {
      Alert.alert("تعذر التحقق", e?.message || "حاول مرة أخرى");
    } finally {
      setVerifying(false);
    }
  }

  async function onPaymentResult(result: PaymentResult) {
    if (result instanceof PaymentResponse) {
      if (result.status === PaymentStatus.paid) return verify(result.id);
      if (result.status === PaymentStatus.failed) {
        await verify(result.id).catch(() => undefined);
        setCheckout(null);
        return Alert.alert("لم تتم العملية", "يمكنك المحاولة مرة أخرى دون إنشاء المناسبة من جديد.");
      }
      return;
    }
    if (result instanceof TokenResponse) return;
    let message = "تعذر إكمال عملية الدفع.";
    if (result instanceof NetworkEndpointError || result instanceof NetworkError) message = "تعذر الاتصال بخدمة الدفع.";
    else if (result instanceof GeneralError || result instanceof UnexpectedError) message = String((result as any).message || message);
    Alert.alert("الدفع", message);
  }

  return (
    <Screen>
      <BrandHeader title="الدفع" subtitle="Apple Pay أو STC Pay أو بطاقة — بدون خيارات زائدة" />
      <ScrollView contentContainerStyle={styles.body}>
        {paid ? (
          <Card>
            <View style={styles.success}>
              <Text style={styles.successMark}>✓</Text>
              <Text style={styles.successTitle}>الباقة مفعّلة</Text>
              <Text style={styles.help}>يمكنك إرسال الدعوات ومتابعة وصولها من داخل المناسبة.</Text>
              <PrimaryButton label="فتح المناسبة" onPress={() => router.replace({ pathname: "/customer/event/[id]" as never, params: { id: eventId } })} />
            </View>
          </Card>
        ) : (
          <>
            <Text style={styles.section}>اختر الباقة</Text>
            {billing?.packages?.map(pkg => (
              <Pressable key={pkg.code} onPress={() => { setSelected(pkg.code); setReferral(null); setCheckout(null); }} style={[styles.package, selected === pkg.code && styles.packageActive]}>
                <View style={styles.packageCopy}>
                  <Text style={[styles.packageName, selected === pkg.code && styles.packageNameActive]}>{pkg.name}</Text>
                  <Text style={[styles.packageGuests, selected === pkg.code && styles.packageGuestsActive]}>حتى {pkg.guestLimit} مدعو</Text>
                </View>
                <Text style={[styles.price, selected === pkg.code && styles.priceActive]}>{pkg.amountSar} ر.س</Text>
              </Pressable>
            ))}
            {billing?.supervisorAddonAmount ? <Card><Text style={styles.cardTitle}>مشرف المناسبة: +{(billing.supervisorAddonAmount / 100).toFixed(2)} ر.س</Text><Text style={styles.help}>يُضاف إلى إجمالي الباقة عند تجهيز طلب الدفع.</Text></Card> : null}
            <Card><Text style={styles.cardTitle}>كود إحالة أو خصم</Text><TextInput value={referralCode} onChangeText={value => { setReferralCode(value); setReferral(null); setCheckout(null); }} autoCapitalize="characters" placeholder="أدخل كود الشريك" style={styles.promoInput} /><PrimaryButton label="تطبيق الكود" onPress={applyReferral} secondary />{referral ? <Text style={styles.help}>تم تطبيق {referral.code}{referral.discountAmount ? ` • خصم ${(referral.discountAmount / 100).toFixed(2)} ر.س` : " • إحالة شريك"}</Text> : null}</Card>
            {billing?.packages?.find(pkg => pkg.code === selected) ? <Card><Text style={styles.cardTitle}>الإجمالي: {(((referral?.discountedPackageAmount ?? billing.packages.find(pkg => pkg.code === selected)!.amount) + (billing.supervisorAddonAmount || 0)) / 100).toFixed(2)} ر.س</Text></Card> : null}

            {!billing?.paymentConfigured ? (
              <Card>
                <Text style={styles.cardTitle}>التكامل جاهز تقنيًا</Text>
                <Text style={styles.help}>المتبقي إضافة مفاتيح Moyasar التجريبية. لن نخزن بيانات البطاقة في هلا، والمفتاح السري لن يخرج من السيرفر.</Text>
              </Card>
            ) : null}

            {!checkout && billing?.payment?.status === "pending" ? (
              <Card>
                <Text style={styles.cardTitle}>لديك عملية دفع سابقة</Text>
                <Text style={styles.help}>إذا أغلقت التطبيق بعد الدفع أو رجعت من المصادقة البنكية، تحقق من العملية بدل إنشاء طلب جديد.</Text>
                <PrimaryButton label="التحقق من العملية السابقة" onPress={() => verify(billing.payment!.id)} loading={verifying} secondary />
              </Card>
            ) : null}

            {!checkout ? (
              <PrimaryButton label={billing?.payment?.status === "failed" ? "إعادة المحاولة" : "متابعة إلى طرق الدفع"} onPress={() => prepare(billing?.payment?.status === "failed")} loading={busy} disabled={!billing} />
            ) : config ? (
              <Card>
                <Text style={styles.cardTitle}>اختر طريقة الدفع</Text>
                <Text style={styles.help}>البطاقة تشمل مدى وVisa وMastercard. لا يتم حفظ البطاقة في هلا.</Text>
                {Platform.OS === "ios" && checkout.features.applePay.enabled ? (
                  <View style={styles.method}><Text style={styles.methodTitle}>Apple Pay</Text><ApplePay paymentConfig={config} onPaymentResult={onPaymentResult} /></View>
                ) : null}
                {checkout.features.stcPay.enabled ? (
                  <View style={styles.method}><Text style={styles.methodTitle}>STC Pay</Text><StcPay paymentConfig={config} onPaymentResult={onPaymentResult} /></View>
                ) : null}
                <View style={styles.method}><Text style={styles.methodTitle}>بطاقة / مدى</Text><CreditCard paymentConfig={config} onPaymentResult={onPaymentResult} /></View>
                <PrimaryButton label="تحقق من الدفع" onPress={() => verify(checkout.order.id)} loading={verifying} secondary />
              </Card>
            ) : null}
          </>
        )}
        <PrimaryButton label="رجوع" onPress={() => router.back()} secondary />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 44, gap: 12 },
  section: { color: theme.colors.ink, fontSize: 21, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  package: { minHeight: 82, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, padding: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  packageActive: { backgroundColor: theme.colors.burgundy, borderColor: theme.colors.gold },
  packageCopy: { alignItems: "flex-end" },
  packageName: { color: theme.colors.ink, fontSize: 17, fontWeight: "900", writingDirection: "rtl" },
  packageNameActive: { color: theme.colors.white },
  packageGuests: { color: theme.colors.muted, marginTop: 5, writingDirection: "rtl" },
  packageGuestsActive: { color: theme.colors.goldSoft },
  price: { color: theme.colors.burgundy, fontSize: 21, fontWeight: "900", writingDirection: "rtl" },
  priceActive: { color: theme.colors.gold },
  cardTitle: { color: theme.colors.burgundy, fontSize: 19, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 8 },
  help: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 21 },
  promoInput: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, paddingHorizontal: 13, color: theme.colors.ink, textAlign: "right", marginBottom: 10 },
  method: { borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 14, marginTop: 14, gap: 8 },
  methodTitle: { color: theme.colors.ink, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  success: { gap: 10, alignItems: "center" },
  successMark: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#E1F5E9", color: theme.colors.success, textAlign: "center", textAlignVertical: "center", fontSize: 30, fontWeight: "900" },
  successTitle: { color: theme.colors.ink, fontSize: 24, fontWeight: "900", writingDirection: "rtl" },
});
