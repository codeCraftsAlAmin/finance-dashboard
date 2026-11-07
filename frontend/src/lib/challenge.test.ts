import { describe, expect, it } from "vitest";
import { addDays, challengeMonths, dayState, daysBetween, monthGrid, progressSeries } from "./challenge";
import type { Challenge } from "./types";

const base: Challenge = {
  id: 1, title: "Docker", goal: null, start_date: "2026-11-20", end_date: "2026-12-19", duration_days: 30,
  state: "active", completed_on: null, completed_early: false, days_early: 0, outcome: null, days_done: 2,
  days_elapsed: 3, days_left: 27, percent: 7, current_streak: 0, best_streak: 1, checked_today: false,
  checkins: [{ date: "2026-11-20", note: null }, { date: "2026-11-22", note: null }],
};

describe("challenge helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-29", 2)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-20", "2026-12-19")).toBe(29);
  });
  it("lists the months a challenge spans", () => {
    expect(challengeMonths("2026-11-20", "2026-12-19")).toEqual(["2026-11", "2026-12"]);
    expect(challengeMonths("2026-12-20", "2027-01-18")).toEqual(["2026-12", "2027-01"]);
    expect(challengeMonths("2026-11-01", "2026-11-30")).toEqual(["2026-11"]);
  });
  it("builds Monday-first month grids", () => {
    const weeks = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday
    expect(weeks[0].slice(0, 6).every((d) => d === null)).toBe(true);
    expect(weeks[0][6]).toBe("2026-11-01");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });
  it("classifies days", () => {
    const today = "2026-11-23";
    expect(dayState(base, "2026-11-20", today)).toBe("done");
    expect(dayState(base, "2026-11-21", today)).toBe("missed");
    expect(dayState(base, "2026-11-23", today)).toBe("today");
    expect(dayState(base, "2026-11-25", today)).toBe("future");
    expect(dayState(base, "2026-11-19", today)).toBe("outside");
    expect(dayState(base, "2026-12-20", today)).toBe("outside");
  });
  it("builds a cumulative series that stops today", () => {
    const series = progressSeries(base, "2026-11-23");
    expect(series).toHaveLength(30);
    expect(series.slice(0, 4).map((p) => p.done)).toEqual([1, 1, 2, 2]);
    expect(series[4].done).toBeNull();
    expect(series[29].pace).toBe(30);
  });
  it("stops at the claim date for completed challenges", () => {
    const done = { ...base, state: "completed" as const, completed_on: "2026-11-22" };
    expect(progressSeries(done, "2026-11-30")[3].done).toBeNull();
    expect(progressSeries(done, "2026-11-30")[2].done).toBe(2);
  });
});
