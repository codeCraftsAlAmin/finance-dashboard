import type { Challenge, ISODate, MonthKey } from "./types";

const DAY_MS = 86_400_000;

function toUtc(day: ISODate): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: ISODate, count: number): ISODate {
  return fromUtc(toUtc(day) + count * DAY_MS);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Every calendar month a challenge touches, in order. */
export function challengeMonths(start: ISODate, end: ISODate): MonthKey[] {
  const months: MonthKey[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const last = end.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push(key);
    if (key >= last) return months;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

/** Weeks (Monday first) for one month. Days outside the month are null. */
export function monthGrid(month: MonthKey): (ISODate | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday = 0
  const cells: (ISODate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => fromUtc(first + i * DAY_MS)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type DayState = "done" | "missed" | "today" | "future" | "outside";

export function dayState(challenge: Challenge, day: ISODate, today: ISODate): DayState {
  if (day < challenge.start_date || day > challenge.end_date) return "outside";
  if (challenge.checkins.some((c) => c.date === day)) return "done";
  if (day === today) return "today";
  return day < today ? "missed" : "future";
}

export interface ProgressPoint {
  day: number;
  date: ISODate;
  /** Days done so far; null after today, or after the challenge was claimed. */
  done: number | null;
  /** Where you would be at one day per day. */
  pace: number;
}

export function progressSeries(challenge: Challenge, today: ISODate): ProgressPoint[] {
  const stop = challenge.completed_on && challenge.completed_on < today ? challenge.completed_on : today;
  const done = new Set(challenge.checkins.map((c) => c.date));
  let running = 0;
  return Array.from({ length: challenge.duration_days }, (_, i) => {
    const date = addDays(challenge.start_date, i);
    if (done.has(date)) running += 1;
    return { day: i + 1, date, done: date <= stop ? running : null, pace: i + 1 };
  });
}
