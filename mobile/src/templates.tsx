import React from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";
import { AtlasKey, TemplateOption } from "./templateCatalog";
export { templatesFor } from "./templateCatalog";
export type { OccasionKey, ActivityKey, TemplateOption } from "./templateCatalog";

const atlases: Record<AtlasKey, ImageSourcePropType> = {
  activities: require("../assets/templates/atlas-activities-a.webp"),
  social: require("../assets/templates/atlas-social.webp"),
  events: require("../assets/templates/atlas-events.webp"),
  formal: require("../assets/templates/atlas-formal.webp"),
};

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
  shade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(9,5,9,.18)" },
  inner: { position: "absolute", inset: 9 as any, borderWidth: 1, borderColor: "rgba(227,189,100,.55)", borderRadius: 12 },
  copy: { position: "absolute", left: 12, right: 12, bottom: 12, alignItems: "flex-end" },
  label: { color: "#F0D58F", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  name: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 3, writingDirection: "rtl", textAlign: "right" },
});
