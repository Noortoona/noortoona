import React from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";

export type OccasionKey = "wedding" | "engagement" | "graduation" | "birthday" | "activity" | "custom";
export type ActivityKey = "padel" | "football" | "camp" | "chalet" | "trip" | "dinner" | "activityCustom";
type AtlasKey = "activities" | "social" | "events" | "formal";

export type TemplateOption = {
  name: string;
  atlas: AtlasKey;
  row: number;
  col: number;
  accent: string;
};

const atlases: Record<AtlasKey, ImageSourcePropType> = {
  activities: require("../assets/templates/atlas-activities-a.webp"),
  social: require("../assets/templates/atlas-social.webp"),
  events: require("../assets/templates/atlas-events.webp"),
  formal: require("../assets/templates/atlas-formal.webp"),
};

const make = (atlas: AtlasKey, row: number, names: string[]): TemplateOption[] =>
  names.map((name, col) => ({ name, atlas, row, col, accent: col === 3 ? "#9A7434" : "#E3BD64" }));

export const templateCatalog: Record<string, TemplateOption[]> = {
  wedding: make("social", 2, ["ليلة كحلية", "حديقة اللؤلؤ", "أقواس ذهبية", "مخمل ملكي"]),
  engagement: make("social", 3, ["وعد من ذهب", "لؤلؤة الملكة", "زمردة", "نقاء"]),
  graduation: make("events", 0, ["قبعة النجاح", "ثمرة السنين", "منصة المجد", "بداية"]),
  birthday: make("social", 4, ["شموع ذهبية", "هدية الليل", "ورد وفرح", "ليلة احتفال"]),
  custom: make("formal", 3, ["ذهب تجريدي", "ظل نباتي", "بريق الليل", "مخمل عنابي"]),
  padel: make("activities", 0, ["ليلي كلاسيك", "ملعب مفتوح", "مودرن", "نادي بادل"]),
  football: make("activities", 1, ["ليلة الملعب", "هدف", "خطة اللعب", "النادي"]),
  camp: make("activities", 2, ["خيمة النجوم", "نار ومسامر", "مجلس البر", "شروق الصحراء"]),
  chalet: make("activities", 3, ["جلسة النار", "ليلة المسبح", "المجلس الراقي", "حديقة الأصحاب"]),
  trip: make("social", 0, ["طريق القمر", "درب الجبل", "موعد السفر", "طريق الشروق"]),
  dinner: make("social", 1, ["شموع المساء", "سطح المدينة", "عشاء المجلس", "المائدة العاجية"]),
  activityCustom: make("activities", 4, ["لياقة", "رحلة بحرية", "أمسية ألعاب", "سينما البر"]),
};

export function templatesFor(occasion: OccasionKey, activity: ActivityKey) {
  return templateCatalog[occasion === "activity" ? activity : occasion] || templateCatalog.custom;
}

export function TemplateArtwork({ template, label, selected = false }: { template: TemplateOption; label: string; selected?: boolean }) {
  return (
    <View style={[styles.frame, selected && styles.selected]}>
      <Image
        source={atlases[template.atlas]}
        resizeMode="stretch"
        style={[
          styles.atlas,
          {
            left: `${-template.col * 100}%` as any,
            top: `${-template.row * 100}%` as any,
          },
        ]}
      />
      <View style={styles.shade} />
      <View style={styles.inner} />
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.name}>{template.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    aspectRatio: 3 / 4.45,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: theme.colors.burgundyDeep,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  selected: { borderWidth: 3, borderColor: theme.colors.gold },
  atlas: { position: "absolute", width: "400%", height: "500%" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,5,9,.18)" },
  inner: { position: "absolute", inset: 9 as any, borderWidth: 1, borderColor: "rgba(227,189,100,.55)", borderRadius: 12 },
  copy: { position: "absolute", left: 12, right: 12, bottom: 12, alignItems: "flex-end" },
  label: { color: "#F0D58F", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  name: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 3, writingDirection: "rtl", textAlign: "right" },
});
