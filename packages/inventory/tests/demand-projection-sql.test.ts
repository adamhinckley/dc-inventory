import { describe, expect, it } from "vitest";
import {
  computeAvailableToSell,
  computeEffectiveSellState,
  projectDemandFigures,
} from "../src/domain/demand-model.js";
import { freezeStockFigures } from "../src/domain/snapshot.js";

type SnapshotRow = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
}>;

function evaluateSqlMirror(row: SnapshotRow, now: Date) {
  const demand = {
    committed: row.committed,
    stickyLocked: row.stickyLocked,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
  };
  const sellState = computeEffectiveSellState(demand, now);
  const locked = sellState === "locked";
  const availableToSell = computeAvailableToSell(
    sellState,
    row.onHand,
    row.onOrder,
    row.committed,
  );
  return { locked, sellState, availableToSell };
}

function projectRow(row: SnapshotRow, now: Date) {
  return projectDemandFigures(
    freezeStockFigures(row.onHand, row.onOrder, row.allocated),
    {
      committed: row.committed,
      stickyLocked: row.stickyLocked,
      windowOpensAt: row.windowOpensAt,
      windowClosesAt: row.windowClosesAt,
    },
    now,
  );
}

const NOW = new Date("2026-09-03T12:00:00.000Z");

const CASES: readonly SnapshotRow[] = [
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
    onHand: 10,
    onOrder: 5,
    allocated: 2,
    committed: 3,
    stickyLocked: true,
    windowOpensAt: null,
    windowClosesAt: null,
  },
  {
    onHand: 8,
    onOrder: 0,
    allocated: 0,
    committed: 1,
    stickyLocked: false,
    windowOpensAt: new Date("2026-09-03T13:00:00.000Z"),
    windowClosesAt: null,
  },
  {
    onHand: 4,
    onOrder: 2,
    allocated: 0,
    committed: 5,
    stickyLocked: false,
    windowOpensAt: null,
    windowClosesAt: new Date("2026-09-03T11:00:00.000Z"),
  },
  {
    onHand: 20,
    onOrder: 10,
    allocated: 4,
    committed: 7,
    stickyLocked: false,
    windowOpensAt: new Date("2026-09-03T10:00:00.000Z"),
    windowClosesAt: new Date("2026-09-03T14:00:00.000Z"),
  },
];

describe("demand projection SQL mirror", () => {
  it.each(CASES.map((row, index) => [index, row] as const))(
    "matches projectDemandFigures for case %i",
    (_index, row) => {
      const projected = projectRow(row, NOW);
      const mirrored = evaluateSqlMirror(row, NOW);
      expect(mirrored.sellState).toBe(projected.sellState);
      expect(mirrored.availableToSell).toBe(projected.availableToSell);
      expect(mirrored.locked).toBe(projected.sellState === "locked");
    },
  );

  it("sorts open before locked and null availableToSell after numeric values ascending", () => {
    const projected = CASES.map((row) => projectRow(row, NOW));
    const ascBySellState = [...projected].sort((a, b) => {
      const rank = (sellState: typeof a.sellState) => (sellState === "open" ? 0 : 1);
      return rank(a.sellState) - rank(b.sellState);
    });
    expect(ascBySellState[0]?.sellState).toBe("open");

    const ascByAts = [...projected].sort((a, b) => {
      const aValue = a.availableToSell;
      const bValue = b.availableToSell;
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return aValue - bValue;
    });
    expect(ascByAts.at(-1)?.availableToSell).toBeNull();
    expect(ascByAts.filter((row) => row.availableToSell !== null).length).toBeGreaterThan(0);
  });
});
