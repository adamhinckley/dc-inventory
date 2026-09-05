import { describe, expect, it } from "vitest";
import {
  computeColumnWidths,
  tableMinWidthPx,
  tableRootClassName,
} from "../src/ui/Table/Table";
import type { TableColumnDef } from "../src/ui/Table/Table.hook";

function column(
  id: string,
  overrides: Partial<TableColumnDef<{ id: string }>> = {},
): TableColumnDef<{ id: string }> {
  return { id, label: id, sort: false, ...overrides };
}

describe("computeColumnWidths", () => {
  it("gives leftover space to the fill column when the card is wide enough", () => {
    expect(
      computeColumnWidths(
        [column("sku", { width: 140 }), column("name")],
        false,
        false,
        500,
        "name",
      ),
    ).toEqual([140, 360]);
  });

  it("reserves the labeled row-actions column so icon+label buttons fit", () => {
    expect(
      computeColumnWidths(
        [column("sku", { width: 140 }), column("name")],
        false,
        true,
        500,
        "name",
      ),
    ).toEqual([140, 160]);
  });

  it("keeps the fill column at its floor when fixed columns overflow the card", () => {
    expect(
      computeColumnWidths(
        [column("sku", { width: 400 }), column("name", { minWidth: 120 })],
        false,
        false,
        300,
        "name",
      ),
    ).toEqual([400, 120]);
  });
});

describe("tableMinWidthPx", () => {
  it("sums resolved widths so a wide mill table can scroll horizontally", () => {
    expect(tableMinWidthPx([column("a"), column("b")], false, false, [400, 120], "b")).toBe(
      520,
    );
  });

  it("uses declared widths before the card is measured", () => {
    expect(
      tableMinWidthPx(
        [column("sku", { width: 140 }), column("name", { minWidth: 200 })],
        false,
        false,
        null,
        "name",
      ),
    ).toBe(340);
  });
});

describe("tableRootClassName", () => {
  it("does not grow a sticky card when the caller passes flex-1", () => {
    const classes = tableRootClassName(true, "min-h-0 flex-1").split(/\s+/);
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-initial");
    expect(classes).not.toContain("flex-1");
  });
});
