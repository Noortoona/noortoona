export function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, char => String(char.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, char => String(char.charCodeAt(0) - 0x6f0));
}

export function normalizeSaudiPhone(value: string): string | null {
  let phone = normalizeDigits(value).replace(/\D/g, "");
  if (phone.startsWith("00966")) phone = phone.slice(2);
  if (phone.startsWith("0")) phone = phone.slice(1);
  if (/^5\d{8}$/.test(phone)) phone = `966${phone}`;
  return /^9665\d{8}$/.test(phone) ? phone : null;
}

/** Admin/staff email is validated client-side for UX; the server authorizes it. */
export function normalizeAdminEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
