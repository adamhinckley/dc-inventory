import { describe, expect, it } from "vitest";
import { InvalidSkuError, Sku } from "../src/index.js";

describe("Sku", () => {
  it("accepts a non-empty stock-keeping identity", () => {
    const sku = Sku.parse("WIDGET-1");
    expect(sku.toString()).toBe("WIDGET-1");
    expect(sku.value).toBe("WIDGET-1");
  });

  it("rejects empty or whitespace-only values", () => {
    expect(() => Sku.parse("")).toThrow(InvalidSkuError);
    expect(() => Sku.parse("   ")).toThrow(InvalidSkuError);
  });

  it("accepts the max length and rejects one character over", () => {
    const max = "A".repeat(64);
    expect(Sku.parse(max).value).toBe(max);
    expect(() => Sku.parse(`${max}X`)).toThrow(InvalidSkuError);
  });

  it("rejects leading or trailing whitespace (no silent identity change)", () => {
    expect(() => Sku.parse(" WIDGET-1")).toThrow(InvalidSkuError);
    expect(() => Sku.parse("WIDGET-1 ")).toThrow(InvalidSkuError);
  });

  it("equals another Sku with the same value", () => {
    expect(Sku.parse("A").equals(Sku.parse("A"))).toBe(true);
    expect(Sku.parse("A").equals(Sku.parse("B"))).toBe(false);
  });
});
