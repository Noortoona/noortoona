const pad = (value: number) => String(value).padStart(2, "0");

// Event dates and times are local wall-clock values, not UTC timestamps.
export function eventDateValue(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function eventTimeValue(value: Date): string {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function parseEventDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year >= 1000 && eventDateValue(date) === value ? date : null;
}

export function parseEventTime(value: string): Date | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function eventDateLabel(value: string): string {
  const date = parseEventDate(value);
  return date ? `${pad(date.getDate())} / ${pad(date.getMonth() + 1)} / ${date.getFullYear()}` : "اختر التاريخ";
}

export function eventTimeLabel(value: string): string {
  const time = parseEventTime(value);
  if (!time) return "اختر الوقت";
  const hour = time.getHours();
  return `${hour % 12 || 12}:${pad(time.getMinutes())} ${hour < 12 ? "صباحًا" : "مساءً"}`;
}
