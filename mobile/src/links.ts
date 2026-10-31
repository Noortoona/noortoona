export function isGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (url.hostname === "maps.app.goo.gl" || url.hostname === "goo.gl" && url.pathname.startsWith("/maps") ||
        /^(www\.|maps\.)?google\.(com|com\.sa)$/.test(url.hostname) && url.pathname.startsWith("/maps"));
  } catch { return false; }
}

export function mapsLinks(location?: string, mapsUrl?: string) {
  const destination = (location || "").trim();
  const saved = mapsUrl && isGoogleMapsUrl(mapsUrl) ? mapsUrl : null;
  return {
    view: saved || (destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}` : null),
    directions: destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : saved,
  };
}
