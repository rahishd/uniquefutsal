// Date helpers pinned to Nepal time (Asia/Kathmandu), so the server gives the same answer
// whatever time zone the host machine uses. Dates are "YYYY-MM-DD" strings.

export const TZ = "Asia/Kathmandu";

function parts(now: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "00";
  return { y: get("year"), m: get("month"), d: get("day"), h: Number(get("hour")), min: Number(get("minute")) };
}

export function todayKey(now: Date = new Date()): string {
  const p = parts(now);
  return `${p.y}-${p.m}-${p.d}`;
}

export function currentHour(now: Date = new Date()): number {
  return parts(now).h;
}

export function currentTime(now: Date = new Date()): string {
  const p = parts(now);
  return `${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
}

// A Date at UTC midnight for the key, used only for calendar arithmetic.
function utc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function key(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDaysKey(k: string, days: number): string {
  const d = utc(k);
  d.setUTCDate(d.getUTCDate() + days);
  return key(d);
}

// Month arithmetic that keeps end-of-month dates valid (31 Jan + 1 month = 28/29 Feb).
export function addMonthsKey(k: string, months: number): string {
  const d = utc(k);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return key(target);
}

export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86400000);
}

export function weekdayOfKey(k: string): number {
  return utc(k).getUTCDay(); // 0 = Sunday
}

export function isValidKey(k: unknown): k is string {
  return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && key(utc(k)) === k;
}

// Epoch ms for a date key + hour in Nepal time (UTC+05:45).
export function startsAtMs(k: string, hour: number): number {
  return utc(k).getTime() + hour * 3600000 - (5 * 60 + 45) * 60000;
}
