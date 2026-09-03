import {
  createDemandProjectionSqlEvaluator,
  type DemandProjectionFixtureRow,
  type DemandProjectionSqlEvaluation,
} from "../../../../packages/inventory/tests/support/evaluate-demand-projection-sql.js";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { productQtyFromSnapshotRow } from "./product-qty-from-snapshot.js";

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

const ROWS: readonly DemandProjectionFixtureRow[] = [
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
  let evaluateSql: (
    row: DemandProjectionFixtureRow,
    now: Date,
  ) => Promise<DemandProjectionSqlEvaluation>;
  let closeEvaluator: () => Promise<void>;

  beforeAll(async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    evaluateSql = evaluator.evaluate.bind(evaluator);
    closeEvaluator = evaluator.close.bind(evaluator);
  });

  afterAll(async () => {
    await closeEvaluator();
  });

  it("matches cell values from productQtyFromSnapshotRow for open and locked SKUs", async () => {
    for (const row of ROWS) {
      const cell = productQtyFromSnapshotRow(row, NOW);
      const sortKeys = await evaluateSql(row, NOW);
      expect(sortKeys.isLocked).toBe(cell.sellState === "locked");
      expect(sortKeys.availableToSell).toBe(cell.availableToSell);
    }
  });

  it("orders availableToSell the same as displayed cell values", async () => {
    const cellValues = ROWS.map((row) => productQtyFromSnapshotRow(row, NOW));
    const sqlValues = [];
    for (const row of ROWS) {
      sqlValues.push(await evaluateSql(row, NOW));
    }
    const byCellAsc = [...cellValues].sort((a, b) =>
      compareAvailableToSell(a.availableToSell, b.availableToSell, "asc"),
    );
    const bySqlAsc = [...sqlValues].sort((a, b) =>
      compareAvailableToSell(a.availableToSell, b.availableToSell, "asc"),
    );
    expect(bySqlAsc.map((row) => row.availableToSell)).toEqual(
      byCellAsc.map((row) => row.availableToSell),
    );
  });

  it("orders sellState the same as displayed cell values", async () => {
    const cellValues = ROWS.map((row) => productQtyFromSnapshotRow(row, NOW));
    const sqlValues = [];
    for (const row of ROWS) {
      sqlValues.push(await evaluateSql(row, NOW));
    }
    const rank = (sellState: "open" | "locked") => (sellState === "open" ? 0 : 1);
    const byCellAsc = [...cellValues].sort((a, b) => rank(a.sellState) - rank(b.sellState));
    const bySqlAsc = [...sqlValues].sort((a, b) => Number(a.isLocked) - Number(b.isLocked));
    expect(bySqlAsc.map((row) => row.isLocked)).toEqual(
      byCellAsc.map((row) => row.sellState === "locked"),
    );
  });
});
