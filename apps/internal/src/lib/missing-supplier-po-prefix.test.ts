import { describe, expect, it } from "vitest";
import { isSupplierPoPrefixMissing } from "./missing-supplier-po-prefix";

describe("isSupplierPoPrefixMissing", () => {
  it("treats blank prefixes as missing", () => {
    expect(isSupplierPoPrefixMissing(null)).toBe(true);
    expect(isSupplierPoPrefixMissing(undefined)).toBe(true);
    expect(isSupplierPoPrefixMissing("")).toBe(true);
    expect(isSupplierPoPrefixMissing("  ")).toBe(true);
    expect(isSupplierPoPrefixMissing("HF")).toBe(false);
  });
});
