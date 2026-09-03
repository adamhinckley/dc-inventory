import { describe, expect, it } from "vitest";
import {
  computeAvailableToSell,
  computeEffectiveSellState,
} from "@dc-inventory/inventory";
import { productQtyFromSnapshotRow } from "./product-qty-from-snapshot.js";

type SnapshotRow = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
}>;

function sqlMirrorSortKeys(row: SnapshotRow, now: Date) {
  const demand = {
    committed: row.committed,
    stickyLocked: row.stickyLocked,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
  };
  const sellState = computeEffectiveSellState(demand, now);
  return {
    sellState,
    isLocked: sellState === "locked",
    availableToSell: computeAvailableToSell(
      sellState,
      row.onHand,
      row.onOrder,
      row.committed,
    ),
  };
}

function compareAvailableToSell(
  a: number | null,
  b: number | null,
  sortOrder: "asc" | "desc",
): number {
  if (a === null && b === null) return 0;
  if (a === null) return sortOrder === "desc" ? -1 : 1;
  if (b === null) return sortOrder === "desc" ? 1 : -1;
  return a - b;
}

const NOW = new Date("2026-09-03T12:00:00.000Z");

const ROWS: readonly SnapshotRow[] = [
  {
    onHand: 10,
    onOrder: 0,
    allocated: 0,
    committed: 0,
    stickyLocked: false,
    windowOpensAt: null,
    windowClosesAt: null,
  },
  {
    onHand: 5,
    onOrder: 10,
    allocated: 0,
    committed: 3,
    stickyLocked: true,
    windowOpensAt: null,
    windowClosesAt: null,
  },
  {
    onHand: 2,
    onOrder: 1,
    allocated: 0,
    committed: 8,
    stickyLocked: true,
    windowOpensAt: null,
    windowClosesAt: null,
  },
  {
    onHand: 7,
    onOrder: 0,
    allocated: 0,
    committed: 1,
    stickyLocked: false,
    windowOpensAt: new Date("2026-09-03T13:00:00.000Z"),
    windowClosesAt: null,
  },
];

describe("CatalogInventoryListQuery demand projection sort keys", () => {
  it("matches cell values from productQtyFromSnapshotRow for open and locked SKUs", () => {
    for (const row of ROWS) {
      const cell = productQtyFromSnapshotRow(row, NOW);
      const sortKeys = sqlMirrorSortKeys(row, NOW);
      expect(sortKeys.sellState).toBe(cell.sellState);
      expect(sortKeys.availableToSell).toBe(cell.availableToSell);
      expect(sortKeys.isLocked).toBe(cell.sellState === "locked");
    }
  });

  it("orders availableToSell the same as displayed cell values", () => {
    const cellValues = ROWS.map((row) => productQtyFromSnapshotRow(row, NOW));
    const byCellAsc = [...cellValues].sort((a, b) =>
      compareAvailableToSell(a.availableToSell, b.availableToSell, "asc"),
    );
    const bySqlMirrorAsc = [...ROWS]
      .map((row) => sqlMirrorSortKeys(row, NOW))
      .sort((a, b) => compareAvailableToSell(a.availableToSell, b.availableToSell, "asc"));
    expect(bySqlMirrorAsc.map((row) => row.availableToSell)).toEqual(
      byCellAsc.map((row) => row.availableToSell),
    );
  });

  it("orders sellState the same as displayed cell values", () => {
    const rank = (sellState: "open" | "locked") => (sellState === "open" ? 0 : 1);
    const byCellAsc = [...ROWS]
      .map((row) => productQtyFromSnapshotRow(row, NOW))
      .sort((a, b) => rank(a.sellState) - rank(b.sellState));
    const bySqlMirrorAsc = [...ROWS]
      .map((row) => sqlMirrorSortKeys(row, NOW))
      .sort((a, b) => Number(a.isLocked) - Number(b.isLocked));
    expect(bySqlMirrorAsc.map((row) => row.sellState)).toEqual(
      byCellAsc.map((row) => row.sellState),
    );
  });
});
