import { drizzle } from "drizzle-orm/postgres-js";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  compareStaffCatalogQtyAvailableToSell,
  projectDemandFigures,
} from "../src/domain/demand-model.js";
import {
  staffCatalogAvailableToSellOrderBySql,
  staffCatalogDemandProjectionSql,
} from "../src/persistence/demand-projection-sql.js";
import { stockSnapshots } from "../src/persistence/schema.js";
import { freezeStockFigures } from "../src/domain/snapshot.js";
import {
  createDemandProjectionSqlEvaluator,
  type DemandProjectionFixtureRow,
  type DemandProjectionSqlEvaluation,
} from "./support/evaluate-demand-projection-sql.js";

const NOW = new Date("2026-09-03T12:00:00.000Z");

const CASES: readonly DemandProjectionFixtureRow[] = [
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

function projectRow(row: DemandProjectionFixtureRow, now: Date) {
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

describe("demand projection SQL lockstep", () => {
  let evaluateSql: (
    row: DemandProjectionFixtureRow,
    now: Date,
  ) => Promise<DemandProjectionSqlEvaluation>;
  let orderByAvailableToSell: (
    rows: readonly DemandProjectionFixtureRow[],
    now: Date,
    sortOrder: "asc" | "desc",
  ) => Promise<readonly (number | null)[]>;
  let closeEvaluator: () => Promise<void>;

  beforeAll(async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    evaluateSql = evaluator.evaluate.bind(evaluator);
    orderByAvailableToSell = evaluator.orderByAvailableToSell.bind(evaluator);
    closeEvaluator = evaluator.close.bind(evaluator);
  });

  afterAll(async () => {
    await closeEvaluator();
  });

  it("builds executable SQL from bundled staff catalog projection fragments", () => {
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
    const { sql: selectSql, params } = db
      .select({
        isLocked: projection.isLockedForSell.as("is_locked"),
        availableToSell: projection.availableToSell.as("available_to_sell"),
      })
      .from(stockSnapshots)
      .orderBy(staffCatalogAvailableToSellOrderBySql(projection.availableToSell, "desc"))
      .toSQL();
    expect(selectSql).toContain("sticky_locked");
    expect(selectSql).toContain("window_opens_at");
    expect(selectSql).toContain("window_closes_at");
    expect(selectSql).toContain("CASE");
    expect(selectSql).toContain("DESC NULLS FIRST");
    expect(params).toContain(nowIso);
  });

  it.each(CASES.map((row, index) => [index, row] as const))(
    "evaluates exported SQL fragments in lockstep with projectDemandFigures for case %i",
    async (_index, row) => {
      const projected = projectRow(row, NOW);
      const sql = await evaluateSql(row, NOW);
      expect(sql.isLocked).toBe(projected.sellState === "locked");
      expect(sql.availableToSell).toBe(projected.availableToSell);
    },
  );

  it("orders availableToSell ascending and descending via bundled ORDER BY on PGLite", async () => {
    const cells = CASES.map((row) => projectRow(row, NOW));
    const byCellAsc = [...cells].sort((a, b) =>
      compareStaffCatalogQtyAvailableToSell(a, b, "asc"),
    );
    const byCellDesc = [...cells].sort((a, b) =>
      compareStaffCatalogQtyAvailableToSell(a, b, "desc"),
    );
    const bySqlAsc = await orderByAvailableToSell(CASES, NOW, "asc");
    const bySqlDesc = await orderByAvailableToSell(CASES, NOW, "desc");
    expect(bySqlAsc).toEqual(byCellAsc.map((row) => row.availableToSell));
    expect(bySqlDesc).toEqual(byCellDesc.map((row) => row.availableToSell));
    expect(bySqlAsc.at(-1)).toBeNull();
    expect(bySqlDesc[0]).toBeNull();
  });
});

const SHOP_SELLABLE_CASES = [
  {
    label: "open leftover in",
    row: {
      onHand: 10,
      onOrder: 0,
      allocated: 0,
      committed: 0,
      stickyLocked: false,
      windowOpensAt: null,
      windowClosesAt: null,
    },
    expected: true,
  },
  {
    label: "open zero out",
    row: {
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      committed: 0,
      stickyLocked: false,
      windowOpensAt: null,
      windowClosesAt: null,
    },
    expected: false,
  },
  {
    label: "locked ATP > 0 in",
    row: {
      onHand: 0,
      onOrder: 100,
      allocated: 0,
      committed: 0,
      stickyLocked: true,
      windowOpensAt: null,
      windowClosesAt: null,
    },
    expected: true,
  },
  {
    label: "locked ATP = 0 out",
    row: {
      onHand: 5,
      onOrder: 0,
      allocated: 0,
      committed: 5,
      stickyLocked: true,
      windowOpensAt: null,
      windowClosesAt: null,
    },
    expected: false,
  },
] as const satisfies ReadonlyArray<{
  label: string;
  row: DemandProjectionFixtureRow;
  expected: boolean;
}>;

describe("isShopSellableSql", () => {
  let evaluateIsShopSellable: (
    row: DemandProjectionFixtureRow,
    now: Date,
  ) => Promise<boolean>;
  let closeEvaluator: () => Promise<void>;

  beforeAll(async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    evaluateIsShopSellable = evaluator.evaluateIsShopSellable.bind(evaluator);
    closeEvaluator = evaluator.close.bind(evaluator);
  });

  afterAll(async () => {
    await closeEvaluator();
  });

  it.each(SHOP_SELLABLE_CASES.map((testCase) => [testCase.label, testCase] as const))(
    "%s",
    async (_label, testCase) => {
      await expect(evaluateIsShopSellable(testCase.row, NOW)).resolves.toBe(testCase.expected);
    },
  );
});
