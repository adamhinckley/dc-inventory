import { describe, expect, it } from "vitest";
import {
  compareStaffCatalogQtyAvailableToSell,
  compareStaffCatalogQtySellState,
  projectStaffCatalogQtyFromSnapshot,
  type StaffCatalogQtySnapshotRow,
} from "../src/domain/demand-model.js";
import {
  availableToSellProjectionSql,
  isLockedForSellSql,
  staffCatalogDemandProjectionSql,
} from "../src/persistence/demand-projection-sql.js";
import { stockSnapshots } from "../src/persistence/schema.js";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  createDemandProjectionSqlEvaluator,
  type DemandProjectionSqlEvaluation,
} from "./support/evaluate-demand-projection-sql.js";

const NOW = new Date("2026-09-03T12:00:00.000Z");

const CASES: readonly StaffCatalogQtySnapshotRow[] = [
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

describe("staff catalog qty projection surface", () => {
  it("bundles SQL sort fragments for catalog list demand projection", () => {
    const db = drizzle.mock({ schema: { stockSnapshots } });
    const nowIso = NOW.toISOString();
    const columns = {
      onHand: stockSnapshots.onHand,
      onOrder: stockSnapshots.onOrder,
      committed: stockSnapshots.committed,
      stickyLocked: stockSnapshots.stickyLocked,
      windowOpensAt: stockSnapshots.windowOpensAt,
      windowClosesAt: stockSnapshots.windowClosesAt,
    };
    const bundled = staffCatalogDemandProjectionSql(columns, nowIso);
    const directLocked = isLockedForSellSql(columns, nowIso);
    const directAvailableToSell = availableToSellProjectionSql(columns, nowIso);
    const { sql: bundledSql } = db
      .select({
        isLocked: bundled.isLockedForSell.as("is_locked"),
        availableToSell: bundled.availableToSell.as("available_to_sell"),
      })
      .from(stockSnapshots)
      .toSQL();
    const { sql: directSql } = db
      .select({
        isLocked: directLocked.as("is_locked"),
        availableToSell: directAvailableToSell.as("available_to_sell"),
      })
      .from(stockSnapshots)
      .toSQL();
    expect(bundledSql).toBe(directSql);
  });

  it.each(CASES.map((row, index) => [index, row] as const))(
    "projects catalog qty cells in lockstep with SQL sort keys for case %i",
    async (_index, row) => {
      const evaluator = await createDemandProjectionSqlEvaluator();
      try {
        const cell = projectStaffCatalogQtyFromSnapshot(row, NOW);
        const sql: DemandProjectionSqlEvaluation = await evaluator.evaluate(row, NOW);
        expect(sql.isLocked).toBe(cell.sellState === "locked");
        expect(sql.availableToSell).toBe(cell.availableToSell);
      } finally {
        await evaluator.close();
      }
    },
  );

  it("sorts availableToSell with the same null placement as SQL ascending", async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    try {
      const cells = CASES.map((row) => projectStaffCatalogQtyFromSnapshot(row, NOW));
      const sqlValues = [];
      for (const row of CASES) {
        sqlValues.push(await evaluator.evaluate(row, NOW));
      }
      const byCellAsc = [...cells].sort((a, b) =>
        compareStaffCatalogQtyAvailableToSell(a, b, "asc"),
      );
      const bySqlAsc = [...sqlValues].sort((a, b) => {
        const aValue = a.availableToSell;
        const bValue = b.availableToSell;
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        return aValue - bValue;
      });
      expect(bySqlAsc.map((row) => row.availableToSell)).toEqual(
        byCellAsc.map((row) => row.availableToSell),
      );
    } finally {
      await evaluator.close();
    }
  });

  it("sorts sellState with the same open-before-locked order as SQL ascending", async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    try {
      const cells = CASES.map((row) => projectStaffCatalogQtyFromSnapshot(row, NOW));
      const sqlValues = [];
      for (const row of CASES) {
        sqlValues.push(await evaluator.evaluate(row, NOW));
      }
      const byCellAsc = [...cells].sort(compareStaffCatalogQtySellState);
      const bySqlAsc = [...sqlValues].sort((a, b) => Number(a.isLocked) - Number(b.isLocked));
      expect(bySqlAsc.map((row) => row.isLocked)).toEqual(
        byCellAsc.map((row) => row.sellState === "locked"),
      );
    } finally {
      await evaluator.close();
    }
  });
});
