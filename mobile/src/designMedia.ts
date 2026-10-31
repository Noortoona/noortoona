export const MAX_IMAGE_DATA_LENGTH = 600_000;
export const MAX_AUDIO_BYTES = 600 * 1024;

function checkedBase64(value: string) {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("تعذر قراءة الملف المحدد.");
  return value;
}

export function imageDataUri(base64: string) {
  const data = checkedBase64(base64);
  const mime = data.startsWith("/9j/") ? "image/jpeg" : data.startsWith("iVBOR") ? "image/png" : data.startsWith("UklGR") ? "image/webp" : null;
  if (!mime) throw new Error("اختر صورة JPEG أو PNG أو WebP.");
  const uri = `data:${mime};base64,${data}`;
  if (uri.length > MAX_IMAGE_DATA_LENGTH) throw new Error("الصورة كبيرة. قصّ الصورة أو اختر صورة أصغر.");
  return uri;
}

export function audioDataUri(base64: string, mimeType = "", fileName = "") {
  const data = checkedBase64(base64);
  const mimeByExtension: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", wav: "audio/wav" };
  const allowed = ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac"];
  const mime = allowed.includes(mimeType) ? mimeType : mimeByExtension[fileName.split(".").pop()?.toLowerCase() || ""];
  if (!mime) throw new Error("اختر ملف MP3 أو M4A أو AAC أو OGG أو WAV.");
  const bytes = Math.floor(data.length * 3 / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
  if (bytes > MAX_AUDIO_BYTES) throw new Error("اختر ملف صوت لا يتجاوز 600 كيلوبايت.");
  return `data:${mime};base64,${data}`;
}
