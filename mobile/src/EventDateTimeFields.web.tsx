import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";

type Props = { date: string; time: string; onDateChange: (value: string) => void; onTimeChange: (value: string) => void };

export function EventDateTimeFields({ date, time, onDateChange, onTimeChange }: Props) {
  return (
    <View style={styles.row}>
      {(["date", "time"] as const).map(field => (
        <View key={field} style={styles.half}>
          <Text style={styles.label}>{field === "date" ? "التاريخ" : "الوقت"}</Text>
          <input type={field} aria-label={field === "date" ? "التاريخ" : "الوقت"} value={field === "date" ? date : time} onChange={event => (field === "date" ? onDateChange : onTimeChange)(event.currentTarget.value)} style={{ width: "100%", boxSizing: "border-box", minHeight: 56, border: `1px solid ${theme.colors.line}`, borderRadius: 15, backgroundColor: theme.colors.paper, color: theme.colors.ink, padding: 12, fontSize: 16, fontFamily: "inherit", colorScheme: "light" }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row-reverse", gap: 10 },
  half: { flex: 1, minWidth: 0, gap: 8 },
  label: { color: theme.colors.ink, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 5 },
});
