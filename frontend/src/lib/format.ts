import type { ISODate, MonthKey } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SYMBOLS: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€", GBP: "£", INR: "₹" };

/** "BDT" -> "৳"; unknown codes fall back to the code itself. */
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

// en-BD groups digits the South Asian way (1,00,000), which is how people here read amounts.
const groupers = new Map<string, Intl.NumberFormat>();
function grouper(currency: string, fractionDigits: number): Intl.NumberFormat {
  const locale = currency === "BDT" || currency === "INR" ? "en-IN" : "en-US";
  const key = `${locale}:${fractionDigits}`;
  let formatter = groupers.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    groupers.set(key, formatter);
  }
  return formatter;
}

/** 300000 -> "৳3,000"; 12550 -> "৳125.50". Whole amounts drop the decimals. */
export function formatMoney(minor: number, currency: string, options: { sign?: boolean } = {}): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = abs % 100 === 0;
  const body = grouper(currency, whole ? 0 : 2).format(abs / 100);
  const sign = negative ? "−" : options.sign && minor > 0 ? "+" : "";
  return `${sign}${currencySymbol(currency)}${body}`;
}

/** Short form for chart axes: 1.2k, 3.4L (lakh), 1.1Cr. */
export function formatCompact(minor: number, currency: string): string {
  const value = Math.abs(minor) / 100;
  const south = currency === "BDT" || currency === "INR";
  let text: string;
  if (south && value >= 1e7) text = `${trim(value / 1e7)}Cr`;
  else if (south && value >= 1e5) text = `${trim(value / 1e5)}L`;
  else if (value >= 1e9) text = `${trim(value / 1e9)}B`;
  else if (!south && value >= 1e6) text = `${trim(value / 1e6)}M`;
  else if (value >= 1e3) text = `${trim(value / 1e3)}k`;
  else text = trim(value);
  return `${minor < 0 ? "−" : ""}${currencySymbol(currency)}${text}`;
}

function trim(value: number): string {
  return value >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString();
}

/** "3,000.50" -> 300050. Returns null for anything that isn't a positive amount. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[,\s৳$€£₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** 125050 -> "1250.50" for putting an existing amount back into an input. */
export function minorToInput(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

export function monthLabel(month: MonthKey, long = false): string {
  const [year, number] = month.split("-").map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[number - 1]} ${year}`;
}

export function monthShort(month: MonthKey): string {
  return MONTHS[Number(month.split("-")[1]) - 1];
}

export function monthOf(day: ISODate): MonthKey {
  return day.slice(0, 7);
}

export function addMonths(month: MonthKey, count: number): MonthKey {
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + (number - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** "2026-11-05" -> "5 Nov 2026" (year dropped when `short` and it is the current year). */
export function formatDay(day: ISODate, today?: ISODate): string {
  const [year, month, date] = day.split("-").map(Number);
  const showYear = !today || Number(today.slice(0, 4)) !== year;
  return `${date} ${MONTHS[month - 1]}${showYear ? ` ${year}` : ""}`;
}

export function weekday(day: ISODate): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** Today's date in a timezone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(now);
  }
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function daysLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export function percent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}
