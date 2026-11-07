import { describe, expect, it } from "vitest";
import {
  addMonths,
  daysLabel,
  formatCompact,
  formatDay,
  formatMoney,
  minorToInput,
  monthLabel,
  parseMoney,
  todayIn,
} from "./format";

describe("formatMoney", () => {
  it("drops decimals on whole amounts and groups the South Asian way", () => {
    expect(formatMoney(300_000, "BDT")).toBe("৳3,000");
    expect(formatMoney(12_345_000, "BDT")).toBe("৳1,23,450");
    expect(formatMoney(12_550, "BDT")).toBe("৳125.50");
  });
  it("handles signs and other currencies", () => {
    expect(formatMoney(-50_000, "BDT")).toBe("−৳500");
    expect(formatMoney(50_000, "BDT", { sign: true })).toBe("+৳500");
    expect(formatMoney(0, "BDT", { sign: true })).toBe("৳0");
    expect(formatMoney(123_456, "USD")).toBe("$1,234.56");
    expect(formatMoney(100, "CHF")).toBe("CHF 1");
  });
});

describe("formatCompact", () => {
  it("uses lakh and crore for BDT and k/M elsewhere", () => {
    expect(formatCompact(300_000, "BDT")).toBe("৳3k");
    expect(formatCompact(15_000_000, "BDT")).toBe("৳1.5L");
    expect(formatCompact(2_000_000_000, "BDT")).toBe("৳2Cr");
    expect(formatCompact(250_000_000, "USD")).toBe("$2.5M");
    expect(formatCompact(-120_000, "BDT")).toBe("−৳1.2k");
  });
});

describe("parseMoney", () => {
  it("reads typed amounts into minor units", () => {
    expect(parseMoney("3,000")).toBe(300_000);
    expect(parseMoney("৳ 125.5")).toBe(12_550);
    expect(parseMoney("0.05")).toBe(5);
  });
  it("rejects anything that is not a positive amount", () => {
    for (const bad of ["", "0", "-5", "abc", "1.234", "1e5", "  "]) expect(parseMoney(bad)).toBeNull();
  });
  it("round-trips through minorToInput", () => {
    expect(minorToInput(300_000)).toBe("3000");
    expect(minorToInput(12_550)).toBe("125.50");
    expect(parseMoney(minorToInput(12_550))).toBe(12_550);
  });
});

describe("dates", () => {
  it("labels and shifts months across year boundaries", () => {
    expect(monthLabel("2026-11")).toBe("Nov 2026");
    expect(monthLabel("2026-01", true)).toBe("January 2026");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-11", 0)).toBe("2026-11");
  });
  it("hides the year for the current year", () => {
    expect(formatDay("2026-11-05", "2026-01-01")).toBe("5 Nov");
    expect(formatDay("2025-11-05", "2026-01-01")).toBe("5 Nov 2025");
  });
  it("finds today in the given timezone", () => {
    const instant = new Date("2026-11-05T20:00:00Z");
    expect(todayIn("Asia/Dhaka", instant)).toBe("2026-11-06");
    expect(todayIn("UTC", instant)).toBe("2026-11-05");
  });
  it("describes distances", () => {
    expect(daysLabel(0)).toBe("Today");
    expect(daysLabel(1)).toBe("Tomorrow");
    expect(daysLabel(12)).toBe("In 12 days");
    expect(daysLabel(-3)).toBe("3 days ago");
  });
});
