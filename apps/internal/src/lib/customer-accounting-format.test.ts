import { describe, expect, it } from "vitest";
import {
  parseDollarsToCents,
  parseSignedDollarsToCents,
} from "./customer-accounting-format";

describe("customer accounting format", () => {
  it("parses positive dollar amounts for record payment", () => {
    expect(parseDollarsToCents("5000")).toBe(500_000);
    expect(parseDollarsToCents("-100")).toBe(0);
    expect(parseDollarsToCents("0")).toBe(0);
  });

  it("parses signed dollar amounts for reallocate and adjust", () => {
    expect(parseSignedDollarsToCents("-250.50")).toBe(-25_050);
    expect(parseSignedDollarsToCents("100")).toBe(10_000);
    expect(parseSignedDollarsToCents("0")).toBe(0);
  });
});
