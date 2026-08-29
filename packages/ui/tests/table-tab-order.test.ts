import { describe, expect, it } from "vitest";
import {
  isSequentialTableTabField,
  tableCellTabIndex,
  tableRowTabIndex,
} from "../src/ui/Table/table-tab-order";

describe("table tab order", () => {
  it("keeps number and text inputs in sequential Tab order", () => {
    expect(isSequentialTableTabField({ tagName: "INPUT", type: "number" })).toBe(
      true,
    );
    expect(isSequentialTableTabField({ tagName: "INPUT", type: "text" })).toBe(
      true,
    );
    expect(isSequentialTableTabField({ tagName: "TEXTAREA" })).toBe(true);
  });

  it("leaves buttons, links, and checkboxes on the roving tabindex", () => {
    expect(
      isSequentialTableTabField({ tagName: "INPUT", type: "checkbox" }),
    ).toBe(false);
    expect(isSequentialTableTabField({ tagName: "BUTTON" })).toBe(false);
    expect(isSequentialTableTabField({ tagName: "A" })).toBe(false);
  });

  it("never takes a sequential field out of the tab order", () => {
    expect(tableCellTabIndex(true, false)).toBe(0);
    expect(tableCellTabIndex(true, true)).toBe(0);
    expect(tableCellTabIndex(false, false)).toBe(-1);
    expect(tableCellTabIndex(false, true)).toBe(0);
  });

  it("does not make the row a tab stop when cells already are", () => {
    expect(tableRowTabIndex(true, true)).toBe(-1);
    expect(tableRowTabIndex(true, false)).toBe(0);
    expect(tableRowTabIndex(false, false)).toBe(-1);
  });
});
