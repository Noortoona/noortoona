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
  "تعذر حفظ الحجز. يمكنك المحاولة مجددًا دون إنشاء طلب آخر.": "Unable to save your booking. You can retry without creating a duplicate request.",
  "ملكة / عقد قران": "Marriage contract",
  "خطوبة": "Engagement",
  "تخرج": "Graduation",
  "عيد ميلاد": "Birthday",
  "مولود": "New baby",
  "اجتماع": "Meeting",
  "مؤتمر": "Conference",
  "مناسبة رسمية": "Formal event",
  "افتتاح": "Opening",
  "تكريم": "Recognition",
  "مناسبة وطنية": "National celebration",
  "عزاء": "Condolences",
  "نشاط / تجمع": "Activity / gathering",
  "أخرى": "Other",
  "بادل": "Padel",
  "كرة قدم": "Football",
  "كشتة": "Outdoor gathering",
  "استراحة / شاليه": "Chalet",
  "رحلة": "Trip",
  "عشاء": "Dinner",
  "نشاط مخصص": "Custom activity",
  "نوع الدعوة": "Invitation type",
  "نوع النشاط": "Activity type",
  "اسم النشاط": "Activity name",
  "اسم الخريج / الخريجة": "Graduate's name",
  "اسم صاحب المناسبة": "Celebrant's name",
  "الاسم الأول": "First name",
  "اسم المناسبة": "Event name",
  "اسم العروس / الطرف الثاني": "Bride / second person's name",
  "الاسم الثاني": "Second name",
  "التاريخ": "Date",
  "الوقت": "Time",
  "الموقع": "Location",
  "اسم القاعة أو الموقع": "Venue or location",
  "رابط Google Maps (اختياري)": "Google Maps link (optional)",
  "جدول الأعمال": "Agenda",
  "محاور المؤتمر والمتحدثون": "Conference topics and speakers",
  "تفاصيل المناسبة الرسمية": "Formal event details",
  "التفاصيل الخاصة بهذا النوع": "Details for this type of event",
  "اكتب نوع النشاط": "Enter activity type",
  "اكتب هنا": "Type here",
  "إعدادات النشاط": "Activity settings",
  "لا يوجد اسم شخص ثانٍ هنا. نركز على المشاركين والقطّة وقائمة الانتظار.": "No second person is needed. Focus on participants, shared costs and the waiting list.",
  "العدد الأقصى": "Maximum participants",
  "القطّة للشخص — اختياري": "Contribution per person — optional",
  "التالي: اختيار القالب": "Next: choose a template",
  "اختر الشكل المناسب": "Choose your design",
  "القوالب المعروضة مخصصة لنوع دعوتك الحالي.": "These templates are selected for your occasion.",
  "العبارة الرئيسية": "Headline",
  "نص الدعوة": "Invitation message",
  "الخط": "Font",
  "اللون الرئيسي": "Accent color",
  "تغيير الصورة / التصميم": "Change photo / artwork",
  "رفع صورة أو تصميم خاص": "Upload a photo or design",
  "إزالة الصورة": "Remove photo",
  "تغيير موسيقى الدعوة": "Change invitation audio",
  "إضافة موسيقى (حتى 600 كيلوبايت)": "Add audio (up to 600 KB)",
  "إزالة الموسيقى": "Remove audio",
  "تُحفظ الصورة والموسيقى ضمن تصميم الدعوة. استخدم ملفات تملك حق مشاركتها.": "The image and audio become part of your invitation. Only upload files you have permission to share.",
  "التالي: الباقة": "Next: package",
  "رجوع": "Back",
  "اختر الباقة": "Choose a package",
  "رقعة": "Ruqaa",
  "تجوال": "Tajawal",
  "كلاسيكي": "Classic",
  "اختيار اللون": "Choose color",
  "إضافة مشرف أو مشرفة للمناسبة": "Add an event supervisor",
  "تفضيل خدمة الاستقبال": "Preferred event supervisor",
  "مشرف": "Male supervisor",
  "مشرفة": "Female supervisor",
  "حسب توفر الكادر في مدينة المناسبة وموعدها.": "Subject to staff availability in your city on the event date.",
  "خدمات المناسبة": "Event services",
  "قبل الدفع لديك إرسال تجريبي مجاني واحد للتأكد من شكل الدعوة ووصولها.": "You have one free test invitation before payment to check its appearance and delivery.",
  "إنشاء المناسبة وتجربتها": "Create and preview event",
  "رجوع للقالب": "Back to template",
  "إلغاء": "Cancel",
  "ر.س": "SAR",
  "مدعو": "guests",
  "تعذر قراءة الصورة. اختر صورة أخرى.": "Unable to read the photo. Choose another.",
  "الصورة": "Photo",
  "تعذر فتح الصور.": "Unable to open photos.",
  "اختر ملف صوت لا يتجاوز 600 كيلوبايت.": "Choose audio no larger than 600 KB.",
  "موسيقى الدعوة": "Invitation audio",
  "تعذر فتح الملف.": "Unable to open file.",
  "اكتب اسم النشاط.": "Enter the activity name.",
  "اكتب الاسم.": "Enter a name.",
  "هذا النوع يحتاج الاسمين.": "Both names are required for this occasion.",
  "أدخل رابط Google Maps صحيحًا يبدأ بـ https://.": "Enter a valid HTTPS Google Maps URL.",
  "أكمل التاريخ والوقت والموقع.": "Enter the date, time and location.",
  "اكتب نوع النشاط.": "Enter the activity type.",
  "أدخل عدد المشاركين.": "Enter the participant count.",
  "القوالب": "Templates",
  "لا توجد قوالب متاحة لهذا النوع حاليًا.": "No templates are available for this occasion yet.",
  "أكمل البيانات": "Complete the details",
  "اختيار المشرف": "Choose a supervisor",
  "اختر مشرفًا أو مشرفة أولًا": "Choose a male or female supervisor first.",
  "تعذر إنشاء المناسبة": "Unable to create event",
  "تفاصيل الدعوة": "Invitation details",
  "اختر القالب": "Choose a template",
  "راجع واختر الباقة": "Review and choose a package",
  "عرض حجزي": "View my booking",
  "التواصل مع خدمة العملاء": "Contact support",
  "تعذر فتح واتساب": "Unable to open WhatsApp",
  "يمكنك العودة لحجزك من حسابك.": "You can return to your booking from your account.",
  "تأكيد طلب الحجز": "Confirm booking request",
  "احفظ طلبك الآن، وسنتواصل لاستكمال الدفع والتأكيد": "Save your request now; we'll contact you to complete payment and confirmation.",
  "عدد المدعوين": "Guest count",
  "إضافة مشرف أو مشرفة": "Add an event supervisor",
  "إضافة مشرف / مشرفة حسب التفضيل المحدد": "Add a supervisor based on your selection",
  "كود الخصم أو الإحالة": "Discount or referral code",
  "عرض السعر النهائي": "View final price",
  "اسم العميل": "Customer name",
  "البريد الإلكتروني — اختياري": "Email — optional",
  "جاري تحميل تفاصيل المناسبة…": "Loading event details...",
  "الخدمات الإضافية:": "Add-ons:",
  "الخصم:": "Discount:",
  "الإجمالي:": "Total:",
  "لا يُخصم منك أي مبلغ عند تأكيد الطلب المبدئي.": "No amount is charged when you confirm a preliminary booking.",
  "أوافق اختياريًا على استقبال أخبار وعروض هلا. لا يؤثر اختياري على الحجز.": "I optionally agree to receive HALA news and offers. This does not affect my booking.",
  "الحجز المبدئي لا يعني الدفع أو الاعتماد النهائي. واتساب للمساعدة فقط.": "A preliminary booking is not payment or final confirmation. WhatsApp is for support only.",
  "سيتواصل معك فريق هلا قريبًا لاستكمال إجراءات الدفع والتأكيد النهائي.": "Our team will contact you to complete payment and final confirmation.",
  "يمكنك متابعة تفاصيل طلبك من حسابك في هلا.": "You can track your request in your HALA account.",
  "تسجيل الطلب لا يعني إتمام الدفع أو اعتماد الحجز النهائي.": "Submitting a request does not complete payment or confirm the booking.",
  "لحظتك .. تبدأ بهلا 🤍": "Your moment starts with HALA 🤍",
  "لديك دعوة غير مكتملة": "You have an incomplete invitation"
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
