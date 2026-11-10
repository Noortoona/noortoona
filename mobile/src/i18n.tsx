import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";

export type HalaLocale = "ar" | "en";
const KEY = "hala.locale";
const translations: Record<string, string> = {
  "هلا": "HALA", "هلا،": "Hello,", "لحظتك .. تبدأ بهلا": "Your moment starts with HALA",
  "خروج": "Sign out", "دخول": "Sign in",
  "العملاء": "Customers", "الإدارة": "Administration", "المشرفين": "Supervisors", "الشركاء": "Partners", "خدمة العملاء": "Customer service",
  "رمز التحقق": "Verification code", "أدخل بريدًا إلكترونيًا صحيحًا.": "Enter a valid email address.",
  "أدخل رقم جوال سعودي صحيحًا.": "Enter a valid Saudi mobile number.",
  "تعذر إكمال العملية": "Unable to complete this action",
  "كن من أوائل عملاء هلا": "Be among HALA's first customers",
  "تصفح واحجز دون تسجيل دخول": "Browse and book without signing in",
  "متابعة حجزي الأخير": "Track my latest booking",
  "أدخل الرمز المرسل إلى البريد الإلكتروني. صلاحيته ٥ دقائق.": "Enter the code emailed to you. It expires in 5 minutes.",
  "أدخل رمز واتساب. صلاحيته ٥ دقائق.": "Enter the WhatsApp code. It expires in 5 minutes.",
  "أدخل البريد المعتمد للإدارة. لا يتطلب اشتراك واتساب.": "Enter the approved admin email. No WhatsApp subscription is required.",
  "ادخل برقمك المسجل. تحدد صلاحيات حسابك اللوحة المتاحة لك.": "Sign in with your registered mobile number. Your role determines which dashboard you can access.",
  "البريد الإلكتروني للإدارة": "Admin email address", "رقم الجوال": "Mobile number",
  "رمز التحقق المكون من ٦ أرقام": "6-digit verification code",
  "تأكيد والدخول": "Verify and sign in", "إرسال الرمز إلى البريد": "Email me a code",
  "إرسال الرمز عبر واتساب": "Send code via WhatsApp", "تغيير البريد": "Change email",
  "تغيير رقم الجوال": "Change mobile number", "الدخول برقم الجوال بدل البريد": "Use mobile number instead",
  "الدخول بالبريد الإلكتروني": "Use email instead",
  "مناسباتك وضيوفك في مكان واحد": "Your events and guests in one place",
  "مساحتك الخاصة": "Your space", "من الفكرة إلى وصول الضيف": "From first idea to guest arrival",
  "أنشئ الدعوة، أرسلها، وتابع التأكيد والدخول من تطبيق واحد.": "Create and send invitations, track RSVPs and manage check-in in one app.",
  "+ إنشاء دعوة جديدة": "+ Create a new invitation", "حجوزاتي ومتابعة الطلبات": "My bookings and requests",
  "مناسباتي": "My events", "المدعوون": "Guests", "أكدوا الحضور": "Accepted", "تم دخولهم": "Checked in",
  "آخر المناسبات": "Recent events", "ما عندك مناسبة حتى الآن": "You have no events yet",
  "ابدأ بأول دعوة، وهلا يرتب لك بقية الخطوات.": "Create your first invitation; HALA helps with the next steps.",
  "تعذر تحميل البيانات": "Unable to load data", "حاول مرة أخرى": "Please try again",
  "أوافق اختياريًا على قياس استخدام التطبيق بمعرّفات تقديرية لتحسين التجربة. هذا منفصل عن الرسائل التسويقية.": "I optionally agree to usage analytics to improve the app. This is separate from marketing consent.",
  "الموافقة الاختيارية على إحصائيات الاستخدام": "Optional usage analytics consent",
  "إدارة هلا": "HALA admin", "نظرة تنفيذية على المنصة": "Platform overview",
  "إدارة الحجوزات والعملاء والاهتمامات": "Manage bookings, customers and leads",
  "المناسبات": "Events", "المشرفون": "Supervisors", "حالة البيانات": "Data status",
  "تم التحميل": "Loaded", "بانتظار": "Waiting",
  "المستخدمون والصلاحيات": "Users and permissions", "إنشاء مشرفين وإدارة حسابات العملاء.": "Create supervisors and manage customer accounts.",
  "تعيين المشرفين": "Assign supervisors", "اربط كل مشرف بالمناسبات التي يديرها فقط.": "Assign each supervisor only to their own events.",
  "شركاء العمل والمشاهير": "Partners and influencers", "الأكواد والإحالات والعمولات المستحقة.": "Referral codes, attribution and commissions.",
  "أحدث المناسبات": "Latest events",
  "سجّل اهتمامك دون إنشاء حجز": "Register your interest without creating a booking",
  "أدخل رقم جوال صحيحًا أو بريدًا إلكترونيًا للتواصل.": "Enter a valid phone number or email to contact you.",
  "تعذر تسجيل طلبك": "Unable to save your request",
  "تم حفظ طلبك بنجاح ✨": "Your request was saved successfully ✨",
  "شكرًا لاهتمامك بهلا. لم يتم إنشاء حجز أو تحصيل أي مبلغ. سنستخدم بيانات التواصل للغرض الذي اخترته فقط.": "Thanks for your interest in HALA. No booking was created or payment collected. We'll only use your details for the purpose you selected.",
  "✓ اهتمام بالإطلاق": "✓ Launch updates", "اهتمام بالإطلاق": "Launch updates",
  "✓ أطلب التواصل معي": "✓ Request contact", "أطلب التواصل معي": "Request contact",
  "الاسم — اختياري": "Name — optional", "الاسم": "Name", "أو البريد الإلكتروني": "Or email address",
  "البريد الإلكتروني": "Email", "الخدمة المطلوبة — اختياري": "Requested service — optional",
  "الخدمة المطلوبة": "Requested service", "الموافقة الاختيارية على الرسائل التسويقية": "Optional marketing consent",
  "أوافق اختياريًا على استقبال أخبار الإطلاق والعروض التسويقية من هلا.": "I optionally agree to receive HALA launch news and promotional offers.",
  "تُحفظ بيانات التواصل لمتابعة طلبك. الموافقة التسويقية مستقلة واختيارية، ويمكن طلب إلغائها من خدمة العملاء.": "Your contact details are saved to follow up. Marketing consent is separate and optional, and can be withdrawn through support.",
  "إرسال طلب التواصل": "Send contact request", "تسجيل اهتمامي": "Register interest",
  "الحجز": "Booking", "تم تسجيل طلب حجزك بنجاح! ✨": "Your booking request was recorded! ✨",
  "شكرًا لاختيارك هلا.": "Thank you for choosing HALA.",
  "تم استلام تفاصيل مناسبتك وحفظ طلبك برقم:": "We received your event details and saved your booking under number:",
  "أدخل عدد المدعوين الصحيح.": "Enter a valid guest count.",
  "تعذر احتساب السعر": "Unable to calculate price",
  "أدخل الاسم ورقم الجوال الصحيح والبريد إن رغبت.": "Enter your name, a valid mobile number, and an email if desired.",
  "عد إلى تفاصيل الدعوة وحدد مشرفًا أو مشرفة قبل إضافة الخدمة.": "Return to invitation details and select a male or female supervisor before adding the service.",
  "تعذر حفظ الحجز. يمكنك المحاولة مجددًا دون إنشاء طلب آخر.": "Unable to save your booking. You can retry without creating a duplicate request."
};

function translate(text: string, locale: HalaLocale): string {
  if (locale === "ar") return text;
  if (translations[text]) return translations[text];
  if (text.startsWith("دخول ")) return "Sign in — " + (translations[text.slice(5)] || text.slice(5));
  if (text.startsWith("هلا، ")) return "Hello, " + text.slice(5);
  return text;
}

type LocaleContextValue = { locale: HalaLocale; isRTL: boolean; t: (text: string) => string; setLocale: (next: HalaLocale) => void };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<HalaLocale>("ar");
  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(KEY).then(saved => {
      if (mounted && (saved === "ar" || saved === "en")) updateLocale(saved);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  const value = useMemo<LocaleContextValue>(() => ({
    locale, isRTL: locale === "ar", t: (text: string) => translate(text, locale),
    setLocale: (next: HalaLocale) => {
      if (next !== "ar" && next !== "en") return;
      updateLocale(next);
      void SecureStore.setItemAsync(KEY, next).catch(() => undefined);
    }
  }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useI18n must be used within LocaleProvider");
  return context;
}

/** Compact direct toggle for the mobile top bar, with no account/API dependency. */
export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return <View style={styles.pill} accessibilityLabel="Language / اللغة">
    {(["ar", "en"] as const).map(code => (
      <Pressable key={code} onPress={() => setLocale(code)} accessibilityRole="button"
        accessibilityLabel={code === "ar" ? "العربية" : "English"}
        accessibilityState={{ selected: locale === code }}
        style={[styles.option, locale === code && styles.selected]}>
        <Text style={[styles.label, locale === code && styles.selectedLabel]}>{code === "ar" ? "العربية" : "English"}</Text>
      </Pressable>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", backgroundColor: theme.colors.paper, borderColor: theme.colors.gold, borderWidth: 1, borderRadius: 28, padding: 3, alignSelf: "flex-start" },
  option: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 24 },
  selected: { backgroundColor: theme.colors.burgundy },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.ink },
  selectedLabel: { color: theme.colors.white }
});
