import { describe, it, expect } from "vitest";
import { xpToNumber, formatCR, crToNumber } from "./monster-types";

describe("xpToNumber", () => {
  it("parses XP strings with thousands separator", () => {
    expect(xpToNumber("22,000 XP")).toBe(22000);
    expect(xpToNumber("1,800 XP")).toBe(1800);
  });

  it("parses XP strings without separator", () => {
    expect(xpToNumber("700 XP")).toBe(700);
    expect(xpToNumber("50 XP")).toBe(50);
  });

  it("parses bare numbers with or without separator", () => {
    expect(xpToNumber("1,800")).toBe(1800);
    expect(xpToNumber("700")).toBe(700);
  });

  it("returns 0 for empty or non-numeric strings", () => {
    expect(xpToNumber("")).toBe(0);
    expect(xpToNumber("XP")).toBe(0);
  });

  it("composes with formatCR without corrupting large XP values", () => {
    expect(formatCR("19", xpToNumber("22,000 XP"))).toBe("19 (22.000 XP)");
  });
});

describe("crToNumber", () => {
  it("parses fractional and integer CRs", () => {
    expect(crToNumber("1/8")).toBe(0.125);
    expect(crToNumber("1/4")).toBe(0.25);
    expect(crToNumber("1/2")).toBe(0.5);
    expect(crToNumber("5")).toBe(5);
  });
});
