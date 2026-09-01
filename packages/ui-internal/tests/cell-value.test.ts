import { describe, expect, it } from "vitest";
import {
  formatFieldDisplay,
  formatStockField,
  readFieldValue,
} from "../src/data-table/cell-value";

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

describe("formatFieldDisplay", () => {
  it("formats ISO instants as a readable date and time", () => {
    expect(formatFieldDisplay("2026-08-29T20:00:16.765Z", "UTC")).toBe(
      "Aug 29, 2026, 8:00 PM",
    );
  });

  it("leaves non-instant values unchanged", () => {
    expect(formatFieldDisplay("BOLT-1")).toBe("BOLT-1");
    expect(formatFieldDisplay(12)).toBe(12);
  });
});

describe("formatStockField", () => {
  it("shows Open when available to sell has no numeric cap", () => {
    expect(formatStockField("availableToSell", null)).toBe("Open");
    expect(formatStockField("availableToSell", undefined)).toBe("Open");
    expect(formatStockField("availableToSell", 14)).toBe(14);
  });

  it("labels sell state without inventing a third value", () => {
    expect(formatStockField("sellState", "open")).toBe("Open");
    expect(formatStockField("sellState", "locked")).toBe("Locked");
    expect(formatStockField("committed", 22)).toBe(22);
  });
});
