import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { normalizeSaudiPhone } from "@/input";
import { analyticsContext, attribution } from "@/prebooking";
import { BrandHeader, Card, PrimaryButton, Screen } from "@/ui";
import { styles } from "@/BookingCheckout";

export default function LaunchInterest() {
  const auth = useAuth();
  const [name, setName] = useState(auth.user?.name || "");
  const [phone, setPhone] = useState(auth.user?.phone || "");
  const [email, setEmail] = useState("");
  const [service, setService] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [kind, setKind] = useState<"launch" | "contact">("launch");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(Crypto.randomUUID());
  const lock = useRef(false);
  useEffect(() => { if (saved) key.current = Crypto.randomUUID(); }, [kind]);
  async function submit() {
    if (lock.current || saved) return;
    const normalized = phone.trim() ? normalizeSaudiPhone(phone) : "";
    if ((phone.trim() && !normalized) || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) || (!normalized && !email.trim())) { setError("أدخل رقم جوال صحيحًا أو بريدًا إلكترونيًا للتواصل."); return; }
    lock.current = true; setBusy(true); setError("");
    try { await api("/api/leads", { method: "POST", body: JSON.stringify({ name: name.trim(), phone: normalized, email: email.trim(), service: service.trim(), marketingConsent: marketing, kind, attribution: await attribution(), ...await analyticsContext(), idempotencyKey: key.current }) }, auth.token); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل طلبك"); }
    finally { setBusy(false); lock.current = false; }
  }
  return <Screen><BrandHeader title="كن من أوائل عملاء هلا" subtitle="سجّل اهتمامك دون إنشاء حجز" /><ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    {saved ? <Card><Text style={styles.heading}>تم حفظ طلبك بنجاح ✨</Text><Text style={styles.text}>شكرًا لاهتمامك بهلا. لم يتم إنشاء حجز أو تحصيل أي مبلغ. سنستخدم بيانات التواصل للغرض الذي اخترته فقط.</Text></Card> : <>
      <PrimaryButton label={kind === "launch" ? "✓ اهتمام بالإطلاق" : "اهتمام بالإطلاق"} secondary onPress={() => setKind("launch")} /><PrimaryButton label={kind === "contact" ? "✓ أطلب التواصل معي" : "أطلب التواصل معي"} secondary onPress={() => setKind("contact")} />
      <Text style={styles.label}>الاسم — اختياري</Text><TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} accessibilityLabel="الاسم" />
      <Text style={styles.label}>رقم الجوال</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" accessibilityLabel="رقم الجوال" />
      <Text style={styles.label}>أو البريد الإلكتروني</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="البريد الإلكتروني" />
      <Text style={styles.label}>الخدمة المطلوبة — اختياري</Text><TextInput style={styles.input} value={service} onChangeText={setService} maxLength={160} accessibilityLabel="الخدمة المطلوبة" />
      <View style={styles.row}><Switch value={marketing} onValueChange={setMarketing} accessibilityLabel="الموافقة الاختيارية على الرسائل التسويقية" /><Text style={styles.flexText}>أوافق اختياريًا على استقبال أخبار الإطلاق والعروض التسويقية من هلا.</Text></View>
      <Text style={styles.text}>تُحفظ بيانات التواصل لمتابعة طلبك. الموافقة التسويقية مستقلة واختيارية، ويمكن طلب إلغائها من خدمة العملاء.</Text>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}<PrimaryButton label={kind === "contact" ? "إرسال طلب التواصل" : "تسجيل اهتمامي"} onPress={() => { void submit(); }} loading={busy} />
    </>}
  </ScrollView></Screen>;
}
