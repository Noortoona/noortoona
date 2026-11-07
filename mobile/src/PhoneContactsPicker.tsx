import React, { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Contacts from "expo-contacts/legacy";
import { theme } from "@/theme";

export type ImportedGuest = { name: string; phone: string };

export function normalizeGuestPhone(phone: string): string {
  const digits = phone.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^\d]/g, "");
  if (digits.startsWith("00966")) return "966" + digits.slice(5);
  if (digits.startsWith("05") && digits.length === 10) return "966" + digits.slice(1);
  if (digits.startsWith("5") && digits.length === 9) return "966" + digits;
  return digits;
}

type ContactItem = ImportedGuest & { key: string };

export function PhoneContactsPicker({ existingPhones, onImport, disabled = false }: {
  existingPhones: string[];
  onImport: (guests: ImportedGuest[]) => Promise<void>;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const existing = useMemo(() => new Set(existingPhones.map(normalizeGuestPhone).filter(Boolean)), [existingPhones]);
  const filtered = useMemo(() => contacts.filter(c => (c.name + " " + c.phone).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [contacts, query]);

  async function open() {
    if (Platform.OS === "web") {
      Alert.alert("جهات الاتصال", "الاختيار المباشر متاح في تطبيق هلا للأيفون والأندرويد. استخدم الإضافة اليدوية عبر المتصفح.");
      return;
    }
    setLoading(true);
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("لم يتم السماح", "يمكنك إضافة الضيوف يدويًا أو السماح لهلا بالوصول لجهات الاتصال من إعدادات الهاتف.");
        return;
      }
      const unique = new Set<string>();
      const entries: ContactItem[] = [];
      let pageOffset = 0;
      let hasNextPage = true;
      // Read only name and phone; never upload the entire address book.
      while (hasNextPage && pageOffset < 10000) {
        const page = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
          pageSize: 500,
          pageOffset,
        });
        for (const contact of page.data) {
          const displayName = (contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ")).trim();
          if (!displayName) continue;
          for (const item of contact.phoneNumbers || []) {
            const number = normalizeGuestPhone(item.number || "");
            if (number.length < 9 || number.length > 15 || unique.has(number) || existing.has(number)) continue;
            unique.add(number);
            entries.push({ key: number, phone: number, name: displayName });
          }
        }
        hasNextPage = page.hasNextPage;
        pageOffset += page.data.length;
        if (!page.data.length) break;
      }
      setContacts(entries);
      setSelected([]);
      setQuery("");
      setVisible(true);
    } catch (error) {
      Alert.alert("تعذر قراءة جهات الاتصال", "يمكنك متابعة إضافة المدعوين يدويًا.");
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    const chosen = contacts.filter(contact => selected.includes(contact.key));
    if (!chosen.length) return;
    setSaving(true);
    try {
      await onImport(chosen.map(({ name, phone }) => ({ name, phone })));
      setVisible(false);
      setSelected([]);
      setContacts([]);
    } catch {
      Alert.alert("لم يكتمل الاستيراد", "راجع قائمة الضيوف وحاول مرة أخرى. لن تُرسل أي دعوات تلقائيًا.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable style={[styles.launch, (loading || disabled) && styles.faded]} disabled={loading || disabled} onPress={open}>
        <Text style={styles.launchText}>{loading ? "جارٍ قراءة جهات الاتصال…" : "اختيار المدعوين من جهات اتصال الهاتف"}</Text>
      </Pressable>
      <Text style={styles.note}>لن نقرأ جهات اتصالك إلا بعد موافقتك، ولن نحفظ إلا الأشخاص الذين تختارهم.</Text>
      <Modal visible={visible} animationType="slide" onRequestClose={() => !saving && setVisible(false)}>
        <View style={styles.modal}>
          <Text style={styles.title}>اختر المدعوين</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالاسم أو الرقم" style={styles.search} textAlign="right" />
          <Text style={styles.note}>حدد الضيوف من القائمة ثم اضغط إضافة. الأرقام الموجودة مسبقًا مستبعدة.</Text>
          <FlatList
            data={filtered}
            keyExtractor={item => item.key}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const checked = selected.includes(item.key);
              return (
                <Pressable onPress={() => setSelected(previous => checked ? previous.filter(p => p !== item.key) : [...previous, item.key])} style={styles.contact} disabled={saving}>
                  <Text style={styles.checkbox}>{checked ? "☑" : "□"}</Text>
                  <View style={styles.info}><Text style={styles.name}>{item.name}</Text><Text style={styles.number}>{item.phone}</Text></View>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.note}>لا توجد جهات اتصال مطابقة لها أرقام جديدة.</Text>}
          />
          <Pressable style={[styles.launch, (!selected.length || saving) && styles.faded]} disabled={!selected.length || saving} onPress={importSelected}>
            <Text style={styles.launchText}>{saving ? "جارٍ إضافة الضيوف…" : `إضافة ${selected.length} مدعو`}</Text>
          </Pressable>
          <Pressable onPress={() => setVisible(false)} disabled={saving} style={styles.cancel}><Text style={styles.cancelText}>إلغاء</Text></Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  launch: { padding: 14, backgroundColor: theme.colors.burgundy, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  launchText: { color: theme.colors.white, fontWeight: "800", writingDirection: "rtl" },
  faded: { opacity: 0.5 },
  note: { color: theme.colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 20, marginBottom: 12 },
  modal: { flex: 1, backgroundColor: theme.colors.cream, padding: 20, paddingTop: 55 },
  title: { fontSize: 23, fontWeight: "900", color: theme.colors.burgundy, textAlign: "right", marginBottom: 15 },
  search: { backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line, padding: 14, borderRadius: 12, marginBottom: 12 },
  contact: { flexDirection: "row-reverse", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  checkbox: { fontSize: 24, color: theme.colors.burgundy, paddingHorizontal: 10 },
  info: { flex: 1, alignItems: "flex-end" },
  name: { fontWeight: "800", fontSize: 16, color: theme.colors.ink, textAlign: "right" },
  number: { color: theme.colors.muted, marginTop: 5 },
  cancel: { padding: 14, alignItems: "center" },
  cancelText: { color: theme.colors.burgundy, fontWeight: "800" },
});
