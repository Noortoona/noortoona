import React, { useState } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { theme } from "./theme";
import { PrimaryButton } from "./ui";
import { eventDateLabel, eventDateValue, eventTimeLabel, eventTimeValue, parseEventDate, parseEventTime } from "./eventDateTime";

type Mode = "date" | "time";
type Props = {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

export function EventDateTimeFields({ date, time, onDateChange, onTimeChange }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState(new Date());

  function open(nextMode: Mode) {
    Keyboard.dismiss();
    setDraft((nextMode === "date" ? parseEventDate(date) : parseEventTime(time)) || new Date());
    setMode(nextMode);
  }

  function commit(value: Date) {
    if (mode === "date") onDateChange(eventDateValue(value));
    else if (mode === "time") onTimeChange(eventTimeValue(value));
    setMode(null);
  }

  return (
    <>
      <View style={styles.row}>
        {(["date", "time"] as const).map(field => {
          const label = field === "date" ? "التاريخ" : "الوقت";
          const value = field === "date" ? date : time;
          const display = field === "date" ? eventDateLabel(date) : eventTimeLabel(time);
          return (
            <View key={field} style={styles.half}>
              <Text style={styles.label}>{label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${display}`} accessibilityHint={field === "date" ? "يفتح التقويم لاختيار تاريخ المناسبة" : "يفتح الساعة لاختيار وقت المناسبة"} onPress={() => open(field)} style={styles.field}>
                <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">{field === "date" ? "▦" : "◷"}</Text>
                <Text style={[styles.value, !value && styles.placeholder]}>{display}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {mode && Platform.OS === "android" ? (
        <DateTimePicker value={draft} mode={mode} display="default" is24Hour={false} onChange={(event, value) => {
          if (event.type === "set" && value) commit(value);
          else setMode(null);
        }} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={() => setMode(null)}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMode(null)} accessibilityLabel="إلغاء اختيار التاريخ أو الوقت" accessibilityRole="button" />
            <View style={styles.dialog} accessibilityViewIsModal>
              <ScrollView contentContainerStyle={styles.dialogBody} bounces={false}>
                <Text style={styles.title} accessibilityRole="header">{mode === "date" ? "اختر تاريخ المناسبة" : "اختر وقت المناسبة"}</Text>
                {mode ? <DateTimePicker key={mode} value={draft} mode={mode} display={mode === "date" ? "inline" : "spinner"} locale="ar-SA-u-ca-gregory" themeVariant="light" textColor={theme.colors.ink} accentColor={theme.colors.burgundy} style={styles.picker} onChange={(_, value) => { if (value) setDraft(value); }} /> : null}
                <PrimaryButton label="تأكيد الاختيار" onPress={() => commit(draft)} />
                <PrimaryButton label="إلغاء" onPress={() => setMode(null)} secondary />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row-reverse", gap: 10 },
  half: { flex: 1, minWidth: 0, gap: 8 },
  label: { color: theme.colors.ink, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  field: { minHeight: 56, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.paper, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { color: theme.colors.gold, fontSize: 23 },
  value: { flex: 1, color: theme.colors.ink, textAlign: "right", fontSize: 14 },
  placeholder: { color: theme.colors.muted },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  dialog: { width: "100%", maxWidth: 480, maxHeight: "85%", borderRadius: 24, backgroundColor: theme.colors.paper, overflow: "hidden" },
  dialogBody: { padding: 16, gap: 12 },
  title: { color: theme.colors.ink, fontSize: 20, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  picker: { width: "100%" },
});
