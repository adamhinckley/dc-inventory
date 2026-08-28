import { describe, expect, it } from "vitest";
import { readFieldValue } from "../src/data-table/cell-value";

describe("readFieldValue", () => {
  it("reads nested dot-path fields", () => {
    const row = { qty: { onHand: 12, available: 10 } };
    expect(readFieldValue(row, "qty.onHand")).toBe(12);
    expect(readFieldValue(row, "qty.missing")).toBeUndefined();
  });
});
