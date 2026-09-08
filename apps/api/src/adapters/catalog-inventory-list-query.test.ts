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
      expect(listed.total).toBe(2);
      const withCost = listed.items.find(
        (row) => row.product.sku.value === "LAST-PO-COST-500",
      );
      expect(withCost?.lastPoCostCents).toBe(500);
      expect(withCost?.supplierName).toBe("Acme Supply");
      expect(
        listed.items.find((row) => row.product.sku.value === "OTHER-FACTORY-SKU")
          ?.supplierName,
      ).toBe("Other Supply");

      await harness.client.query(
        `INSERT INTO purchasing.supplier_products (id, supplier_id, sku)
         VALUES ($1, $2, $3)`,
        ["da209000-0000-4000-8000-000000000108", harness.otherSupplierId, harness.sku],
      );
      const bothFactories = await harness.catalogListQuery.list({
        organizationId: OrganizationId.DEFAULT,
        page: 1,
        pageSize: 25,
        sortBy: "sku",
        sortOrder: "asc",
      });
      expect(
        bothFactories.items.find((row) => row.product.sku.value === harness.sku)
          ?.supplierName,
      ).toBe("Acme Supply, Other Supply");
    } finally {
      await harness.close();
    }
  });

  it("keeps only SKUs linked to the requested factory", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const listed = await harness.catalogListQuery.list({
        organizationId: OrganizationId.DEFAULT,
        supplierId: [harness.supplierId],
        page: 1,
        pageSize: 25,
        sortBy: "sku",
        sortOrder: "asc",
      });
      expect(listed.items.map((row) => row.product.sku.value)).toEqual([harness.sku]);
    } finally {
      await harness.close();
    }
  });

  it("combines category include with primary-supplier exclude filters", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const org = OrganizationId.DEFAULT;
      const hardwareCategoryId = "da209000-0000-4000-8000-000000000301";
      const boltProductId = "da209000-0000-4000-8000-000000000302";
      const nailProductId = "da209000-0000-4000-8000-000000000307";
      const ribbonProductId = "da209000-0000-4000-8000-000000000303";
      await harness.client.exec(`
        CREATE TABLE catalog.categories (
          id uuid PRIMARY KEY,
          organization_id text NOT NULL,
          name text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (organization_id, name)
        );
        CREATE TABLE catalog.product_categories (
          product_id uuid NOT NULL,
          category_id uuid NOT NULL REFERENCES catalog.categories(id),
          PRIMARY KEY (product_id, category_id)
        );
      `);
      await harness.client.query(
        `INSERT INTO catalog.categories (id, organization_id, name) VALUES ($1, $2, 'Hardware')`,
        [hardwareCategoryId, org],
      );
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, 'COMBO-BOLT', 'Combo bolt', 'EA', 100, 50, true)`,
        [boltProductId, org],
      );
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, 'COMBO-RIBBON', 'Combo ribbon', 'EA', 100, 50, true)`,
        [ribbonProductId, org],
      );
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, 'COMBO-NAIL', 'Combo nail', 'EA', 100, 50, true)`,
        [nailProductId, org],
      );
      await harness.client.query(
        `INSERT INTO catalog.product_categories (product_id, category_id) VALUES ($1, $2), ($3, $2), ($4, $2)`,
        [boltProductId, hardwareCategoryId, ribbonProductId, nailProductId],
      );
      await harness.client.query(
        `INSERT INTO purchasing.supplier_products (id, supplier_id, sku)
         VALUES ($1, $2, 'COMBO-BOLT')`,
        ["da209000-0000-4000-8000-000000000304", harness.supplierId],
      );
      await harness.client.query(
        `INSERT INTO purchasing.supplier_products (id, supplier_id, sku)
         VALUES ($1, $2, 'COMBO-BOLT')`,
        ["da209000-0000-4000-8000-000000000305", harness.otherSupplierId],
      );
      await harness.client.query(
        `INSERT INTO purchasing.supplier_products (id, supplier_id, sku)
         VALUES ($1, $2, 'COMBO-RIBBON')`,
        ["da209000-0000-4000-8000-000000000306", harness.otherSupplierId],
      );

      const byCategoryAndExclude = await harness.catalogListQuery.list({
        organizationId: org,
        category: ["Hardware"],
        excludeSupplierId: [harness.supplierId],
        page: 1,
        pageSize: 25,
        sortBy: "sku",
        sortOrder: "asc",
      });
      expect(byCategoryAndExclude.items.map((row) => row.product.sku.value)).toEqual([
        "COMBO-NAIL",
        "COMBO-RIBBON",
      ]);

      const byIncludeAndExclude = await harness.catalogListQuery.list({
        organizationId: org,
        category: ["Hardware"],
        supplierId: [harness.otherSupplierId],
        excludeSupplierId: [harness.supplierId],
        page: 1,
        pageSize: 25,
        sortBy: "sku",
        sortOrder: "asc",
      });
      expect(byIncludeAndExclude.items.map((row) => row.product.sku.value)).toEqual([
        "COMBO-RIBBON",
      ]);
    } finally {
      await harness.close();
    }
  });

  it("filters by effective sell state including a future window lock", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const org = OrganizationId.DEFAULT;
      const stickySku = "STICKY-LOCKED";
      const windowSku = "WINDOW-LOCKED";
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, $3, 'Sticky locked', 'EA', 100, 50, true)`,
        ["da209000-0000-4000-8000-000000000201", org, stickySku],
      );
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, $3, 'Window locked', 'EA', 100, 50, true)`,
        ["da209000-0000-4000-8000-000000000202", org, windowSku],
      );
      await harness.client.query(
        `INSERT INTO inventory.stock_snapshots
          (organization_id, sku, location_id, on_hand, sticky_locked)
         VALUES ($1, $2, $3, 2, true)`,
        [org, stickySku, harness.locationId],
      );
      await harness.client.query(
        `INSERT INTO inventory.stock_snapshots
          (organization_id, sku, location_id, on_hand, sticky_locked, window_opens_at)
         VALUES ($1, $2, $3, 2, false, $4)`,
        [org, windowSku, harness.locationId, "2026-09-03T13:00:00.000Z"],
      );

      const locked = await harness.catalogListQuery.list({
        organizationId: org,
        sellState: "locked",
        page: 1,
        pageSize: 25,
        sortBy: "sku",
        sortOrder: "asc",
      });
      expect(locked.total).toBe(2);
      expect(locked.items.map((row) => row.product.sku.value)).toEqual([
        stickySku,
        windowSku,
      ]);
      expect(locked.items.every((row) => row.qty.sellState === "locked")).toBe(true);

      const open = await harness.catalogListQuery.list({
        organizationId: org,
        sellState: "open",
        page: 1,
        pageSize: 25,
        sortBy: "sku",
        sortOrder: "asc",
      });
      expect(open.items.map((row) => row.product.sku.value)).toEqual([
        harness.sku,
        "OTHER-FACTORY-SKU",
      ]);
      expect(open.total).toBe(2);
    } finally {
      await harness.close();
    }
  });
});
