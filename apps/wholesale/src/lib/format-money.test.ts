import { describe, expect, it } from "vitest";
import { formatMoneyMinorUnits } from "./format-money.js";

describe("formatMoneyMinorUnits", () => {
  it("formats USD minor units for display only", () => {
    expect(formatMoneyMinorUnits(1250, "USD")).toBe("$12.50");
  });

  it("uses the currency exponent instead of a hardcoded /100", () => {
    expect(formatMoneyMinorUnits(1250, "JPY")).toBe("¥1,250");
  });
});
