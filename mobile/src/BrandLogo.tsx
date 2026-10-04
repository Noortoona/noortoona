import React from "react";
import { Image } from "react-native";

export function BrandLogo({ width = 220 }: { width?: number }) {
  return <Image source={require("../assets/hala-logo-gold.png")} style={{ width, height: width * 0.375 }} resizeMode="contain" accessibilityLabel="هلا HALA" />;
}
