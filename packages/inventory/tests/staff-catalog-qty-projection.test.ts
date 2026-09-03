import { describe, expect, it } from "vitest";
import {
  compareStaffCatalogQtyAvailableToSell,
  compareStaffCatalogQtySellState,
  projectStaffCatalogQtyFromSnapshot,
  type StaffCatalogQtySnapshotRow,
} from "../src/domain/demand-model.js";
import {
  staffCatalogAvailableToSellOrderBySql,
  staffCatalogDemandProjectionSql,
} from "../src/persistence/demand-projection-sql.js";
import { stockSnapshots } from "../src/persistence/schema.js";
import { drizzle } from "drizzle-orm/postgres-js";
import { createDemandProjectionSqlEvaluator } from "./support/evaluate-demand-projection-sql.js";

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
  it("builds executable ORDER BY from bundled staff catalog projection SQL", () => {
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
    const projection = staffCatalogDemandProjectionSql(columns, nowIso);
    const { sql: selectSql } = db
      .select({
        availableToSell: projection.availableToSell.as("available_to_sell"),
      })
      .from(stockSnapshots)
      .orderBy(staffCatalogAvailableToSellOrderBySql(projection.availableToSell, "desc"))
      .toSQL();
    expect(selectSql).toContain("CASE");
    expect(selectSql).toContain("DESC NULLS FIRST");
  });

  it.each(CASES.map((row, index) => [index, row] as const))(
    "projects catalog qty cells in lockstep with bundled SQL sort keys for case %i",
    async (_index, row) => {
      const evaluator = await createDemandProjectionSqlEvaluator();
      try {
        const cell = projectStaffCatalogQtyFromSnapshot(row, NOW);
        const sql = await evaluator.evaluate(row, NOW);
        expect(sql.isLocked).toBe(cell.sellState === "locked");
        expect(sql.availableToSell).toBe(cell.availableToSell);
      } finally {
        await evaluator.close();
      }
    },
  );

  it("orders availableToSell ascending via bundled ORDER BY on PGLite", async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    try {
      const cells = CASES.map((row) => projectStaffCatalogQtyFromSnapshot(row, NOW));
      const byCellAsc = [...cells].sort((a, b) =>
        compareStaffCatalogQtyAvailableToSell(a, b, "asc"),
      );
      const bySqlAsc = await evaluator.orderByAvailableToSell(CASES, NOW, "asc");
      expect(bySqlAsc).toEqual(byCellAsc.map((row) => row.availableToSell));
      expect(bySqlAsc.at(-1)).toBeNull();
    } finally {
      await evaluator.close();
    }
  });

  it("orders availableToSell descending with NULLS FIRST via bundled ORDER BY on PGLite", async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    try {
      const cells = CASES.map((row) => projectStaffCatalogQtyFromSnapshot(row, NOW));
      const byCellDesc = [...cells].sort((a, b) =>
        compareStaffCatalogQtyAvailableToSell(a, b, "desc"),
      );
      const bySqlDesc = await evaluator.orderByAvailableToSell(CASES, NOW, "desc");
      expect(bySqlDesc).toEqual(byCellDesc.map((row) => row.availableToSell));
      expect(bySqlDesc[0]).toBeNull();
    } finally {
      await evaluator.close();
    }
  });

  it("orders sellState via bundled projection ORDER BY on PGLite", async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    try {
      const cells = CASES.map((row) => projectStaffCatalogQtyFromSnapshot(row, NOW));
      const byCellAsc = [...cells].sort(compareStaffCatalogQtySellState);
      const bySqlAsc = await evaluator.orderBySellState(CASES, NOW, "asc");
      expect(bySqlAsc).toEqual(byCellAsc.map((row) => row.sellState === "locked"));
    } finally {
      await evaluator.close();
    }
  });
});
