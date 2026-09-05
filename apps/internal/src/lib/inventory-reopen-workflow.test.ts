import { describe, expect, it } from "vitest";
import {
  buildInventoryReopenCommand,
  parseOptionalWindowInstant,
} from "./inventory-reopen-workflow";

describe("inventory reopen workflow", () => {
  it("maps blank window dates to null instants", () => {
    expect(parseOptionalWindowInstant("")).toBeNull();
    expect(parseOptionalWindowInstant("2027-01-15")).toBe(
      new Date(2027, 0, 15).toISOString(),
    );
  });

  it("builds a reopen command for the full filtered match set", () => {
    expect(
      buildInventoryReopenCommand(
        [
          {
            sku: "STYLE-A",
            name: "Style A",
            sellState: "locked",
            onHand: 4,
            onOrder: 0,
          },
          {
            sku: "STYLE-B",
            name: "Style B",
            sellState: "locked",
            onHand: 0,
            onOrder: 12,
          },
        ],
        "2027-01-15",
        "",
      ),
    ).toEqual({
      skus: ["STYLE-A", "STYLE-B"],
      windowOpensAt: new Date(2027, 0, 15).toISOString(),
      windowClosesAt: null,
    });
  });
});
