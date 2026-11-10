import {pendingScans,queueScan,syncScans} from "@/checkinQueue";
import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/api";
import { useRequireRole } from "@/roleGate";
import { BrandHeader, PrimaryButton, Screen } from "@/ui";
import { theme } from "@/theme";

export default function ScannerScreen() {
  const auth = useRequireRole("supervisor");
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId: string; title?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const scanning = useRef(false);
  function unlock() { scanning.current = false; setLocked(false); }
  const [pending,setPending]=useState(0),[syncing,setSyncing]=useState(false);
  useEffect(()=>{if(auth.user&&params.eventId)void pendingScans(auth.user.id,params.eventId).then(v=>setPending(v.length));},[auth.user?.id,params.eventId]);
  const [last, setLast] = useState<string>("");

  if (auth.loading || !auth.user) return null;

  async function scan(data: string) {
    if (scanning.current || !params.eventId || !auth.token) return;
    scanning.current = true;
    setLocked(true);
    try {
      const result = await api<any>("/api/check-in", { method: "POST", body: JSON.stringify({ eventId: params.eventId, code: data }) }, auth.token);
      setLast(result.guest?.name || "");
      Alert.alert(
        result.alreadyCheckedIn ? "تم تسجيله مسبقًا" : "تم الدخول ✓",
        [result.guest?.name, result.warning].filter(Boolean).join("\n"),
        [{ text: "مسح التالي", onPress: unlock }],
        { cancelable: false }
      );
    } catch (e: any) {
      if(!e.status||e.status===408){
       try{setPending(await queueScan(auth.user!.id,params.eventId,data));Alert.alert("بانتظار الاتصال — لم يُعتمد الدخول", "حُفظ المسح للتحقق من الخادم عند عودة الشبكة. لا تسمح بالدخول قبل التحقق. / Saved for server verification; entry is not approved.",[{text:"متابعة",onPress:unlock}],{cancelable:false});return;}catch{}
      }
      Alert.alert("تعذر تسجيل الدخول", e?.message || "الرمز غير صالح", [{ text: "إعادة المحاولة", onPress: unlock }], { cancelable: false });
    }
  }

  if (!permission) return <Screen><BrandHeader title="قارئ QR" /><View style={styles.center}><Text>جاري فحص صلاحية الكاميرا…</Text></View></Screen>;
  if (!permission.granted) return <Screen><BrandHeader title="قارئ QR" subtitle={params.title} /><View style={styles.permission}><Text style={styles.permissionTitle}>نحتاج إذن الكاميرا</Text><Text style={styles.permissionText}>يستخدم هلا الكاميرا فقط لقراءة رمز الدعوة عند الاستقبال.</Text><PrimaryButton label="السماح بالكاميرا" onPress={requestPermission} /><PrimaryButton label="رجوع" onPress={() => router.back()} secondary /></View></Screen>;

  return (
    <Screen style={styles.screen}>
      <View style={{ backgroundColor: theme.colors.cream }}><BrandHeader title="مسح دخول الضيف" subtitle={params.title || "المناسبة"} /></View>
      <View style={styles.cameraWrap}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={locked ? undefined : ({ data }) => scan(data)} />
        <View style={styles.overlay}><View style={styles.finder} /></View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>{locked ? "جارٍ التحقق من الرمز…" : "ضع رمز QR داخل الإطار"}</Text>
        {last ? <Text style={styles.last}>آخر ضيف: {last}</Text> : null}
        {pending?<><Text style={styles.hint}>{pending} مسح معلق — الدخول غير معتمد</Text><PrimaryButton label="التحقق من المسح المعلق" loading={syncing} disabled={locked} onPress={()=>{if(syncing||!auth.token)return;setSyncing(true);void syncScans(auth.user!.id,params.eventId,auth.token).then(rows=>Alert.alert("نتيجة التحقق",rows.map(r=>`${r.guest?.name||"ضيف"}: ${r.alreadyCheckedIn?"سُجل سابقًا — لا تكرر الدخول":"تم تسجيل الدخول"}`).join("\n"))).catch(e=>Alert.alert("لم تكتمل المزامنة",e.message)).finally(()=>{setSyncing(false);void pendingScans(auth.user!.id,params.eventId).then(v=>setPending(v.length));});}}/></>:null}
        <PrimaryButton label="رجوع للمناسبات" onPress={() => router.back()} secondary />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.colors.burgundyDeep },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  permission: { flex: 1, padding: 24, justifyContent: "center", gap: 14 },
  permissionTitle: { color: theme.colors.ink, fontSize: 24, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  permissionText: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 22 },
  cameraWrap: { flex: 1, marginHorizontal: 16, overflow: "hidden", borderRadius: 28, backgroundColor: "#000" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.22)" },
  finder: { width: 230, height: 230, borderWidth: 3, borderColor: theme.colors.gold, borderRadius: 26, backgroundColor: "transparent" },
  footer: { padding: 20, gap: 9, backgroundColor: theme.colors.burgundyDeep },
  hint: { color: theme.colors.white, fontSize: 16, fontWeight: "800", textAlign: "center", writingDirection: "rtl" },
  last: { color: theme.colors.goldSoft, textAlign: "center", writingDirection: "rtl" }
});
