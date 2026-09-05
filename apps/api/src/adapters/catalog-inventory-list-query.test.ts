import {
  compareStaffCatalogQtyAvailableToSell,
  compareStaffCatalogQtySellState,
  projectStaffCatalogQtyFromSnapshot,
  staffCatalogAvailableToSellOrderBySql,
  staffCatalogDemandProjectionSql,
} from "@dc-inventory/inventory";
import { createDemandProjectionSqlEvaluator } from "../../../../packages/inventory/tests/support/evaluate-demand-projection-sql.js";
import type { DemandProjectionFixtureRow } from "../../../../packages/inventory/tests/support/evaluate-demand-projection-sql.js";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { stockSnapshots } from "@dc-inventory/inventory/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CatalogInventoryListQuery } from "./catalog-inventory-list-query.js";
import { createCatalogListQueryPgliteHarness } from "./support/catalog-list-query-pglite.js";
import { productQtyFromSnapshotRow } from "./product-qty-from-snapshot.js";

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
  let orderByAvailableToSell: (
    rows: readonly DemandProjectionFixtureRow[],
    now: Date,
    sortOrder: "asc" | "desc",
  ) => Promise<readonly (number | null)[]>;
  let orderBySellState: (
    rows: readonly DemandProjectionFixtureRow[],
    now: Date,
    sortOrder: "asc" | "desc",
  ) => Promise<readonly boolean[]>;
  let closeEvaluator: () => Promise<void>;

  beforeAll(async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    orderByAvailableToSell = evaluator.orderByAvailableToSell.bind(evaluator);
    orderBySellState = evaluator.orderBySellState.bind(evaluator);
    closeEvaluator = evaluator.close.bind(evaluator);
  });

  afterAll(async () => {
    await closeEvaluator();
  });

  it("uses bundled staff catalog projection SQL with ORDER BY fragments for catalog sort keys", () => {
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
        isLocked: projection.isLockedForSell.as("is_locked"),
        availableToSell: projection.availableToSell.as("available_to_sell"),
      })
      .from(stockSnapshots)
      .orderBy(staffCatalogAvailableToSellOrderBySql(projection.availableToSell, "desc"))
      .toSQL();
    expect(selectSql).toContain('"inventory"."stock_snapshots"');
    expect(selectSql).toContain("CASE");
    expect(selectSql).toContain("DESC NULLS FIRST");
  });

  it("matches cell values from the Inventory staff catalog projection for open and locked SKUs", async () => {
    const evaluator = await createDemandProjectionSqlEvaluator();
    try {
      for (const row of ROWS) {
        const cell = productQtyFromSnapshotRow(row, NOW);
        const projected = projectStaffCatalogQtyFromSnapshot(row, NOW);
        expect(cell).toEqual(projected);
        const sortKeys = await evaluator.evaluate(row, NOW);
        expect(sortKeys.isLocked).toBe(cell.sellState === "locked");
        expect(sortKeys.availableToSell).toBe(cell.availableToSell);
      }
    } finally {
      await evaluator.close();
    }
  });

  it("orders availableToSell the same as displayed cell values via bundled ORDER BY", async () => {
    const cellValues = ROWS.map((row) => productQtyFromSnapshotRow(row, NOW));
    const byCellAsc = [...cellValues].sort((a, b) =>
      compareStaffCatalogQtyAvailableToSell(a, b, "asc"),
    );
    const byCellDesc = [...cellValues].sort((a, b) =>
      compareStaffCatalogQtyAvailableToSell(a, b, "desc"),
    );
    const bySqlAsc = await orderByAvailableToSell(ROWS, NOW, "asc");
    const bySqlDesc = await orderByAvailableToSell(ROWS, NOW, "desc");
    expect(bySqlAsc).toEqual(byCellAsc.map((row) => row.availableToSell));
    expect(bySqlDesc).toEqual(byCellDesc.map((row) => row.availableToSell));
    expect(bySqlDesc[0]).toBeNull();
  });

  it("orders sellState the same as displayed cell values via bundled ORDER BY", async () => {
    const cellValues = ROWS.map((row) => productQtyFromSnapshotRow(row, NOW));
    const byCellAsc = [...cellValues].sort(compareStaffCatalogQtySellState);
    const bySqlAsc = await orderBySellState(ROWS, NOW, "asc");
    expect(bySqlAsc).toEqual(byCellAsc.map((row) => row.sellState === "locked"));
  });
});

describe("CatalogInventoryListQuery supplier lastPoCostCents", () => {
  it("returns bigint last_po_cost_cents without int4 cast overflow", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const listed = await harness.catalogListQuery.list({
        organizationId: OrganizationId.DEFAULT,
        page: 1,
        pageSize: 25,
        sortBy: "sku",
        sortOrder: "asc",
      });
      expect(listed.total).toBe(1);
      expect(listed.items[0]?.lastPoCostCents).toBe(500);
    } finally {
      await harness.close();
    }
  });
});
