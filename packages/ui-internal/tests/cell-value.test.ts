import { describe, expect, it } from "vitest";
import { readFieldValue } from "../src/data-table/cell-value";

describe("readFieldValue", () => {
  it("reads flat and nested fields", () => {
    const row = {
      sku: "BOLT-1",
      qty: { onHand: 12, available: 10 },
      missing: null,
    };
    expect(readFieldValue(row, "sku")).toBe("BOLT-1");
    expect(readFieldValue(row, "qty.onHand")).toBe(12);
    expect(readFieldValue(row, "qty.missing")).toBeUndefined();
    expect(readFieldValue(row, "missing")).toBeNull();
  });
});
