import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function listSqlMigrations(): string[] {
  const dir = resolve(root, "apps/api/drizzle/migrations");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readText(`apps/api/drizzle/migrations/${name}`));
}

const omittedProductColumns = [
  "secondary_name",
  "item2",
  "original_wholesale",
  "carton_to_carton",
  "c_to_c",
  "line_commission",
  "line_comm",
  "oversold_discount",
  "disc_over_sold",
  "standard_cost",
  "category_1",
  "category_10",
  "upcode",
  "mfg_code",
  "onhand_qty",
  "loc_onhand",
  "onpicklist_qty",
  "on_order_qty",
  "vendor_num",
  "vendor_name",
];

describe("Phase 0 catalog / purchasing / inventory schemas (ADA-52)", () => {
  it("registers dump-mapped tables in the API Kit schema barrel", () => {
    const barrel = readText("apps/api/src/infrastructure/schema.ts");
    expect(barrel).toMatch(
      /pgSchema\("catalog"\)|from "\.\/schema\/|@dc-inventory\/catalog\/schema/,
    );
    expect(barrel).toMatch(/products/);
    expect(barrel).toMatch(/productIdentifiers|product_identifiers/);
    expect(barrel).toMatch(/productPackaging|product_packaging/);
    expect(barrel).toMatch(/categories/);
    expect(barrel).toMatch(/productCategories|product_categories/);
    expect(barrel).toMatch(/productImages|product_images/);
    expect(barrel).toMatch(/suppliers/);
    expect(barrel).toMatch(/supplierProducts|supplier_products/);
    expect(barrel).toMatch(/purchaseOrders|purchase_orders/);
    expect(barrel).toMatch(/@dc-inventory\/purchasing\/schema/);
    expect(barrel).toMatch(/purchaseOrderLines|purchase_order_lines/);
    expect(barrel).toMatch(/locations/);
    expect(barrel).toMatch(/reorderPolicies|reorder_policies/);
    expect(barrel).toMatch(/stockMovements|stock_movements/);
    expect(barrel).toMatch(/stockSnapshots|stock_snapshots/);
    expect(existsSync(resolve(root, "packages/db"))).toBe(false);
  });

  it("keeps catalog.products to the named include/stub set and omits the deny-list", () => {
    const sources = [
      readText("apps/api/src/infrastructure/schema.ts"),
      existsSync(resolve(root, "apps/api/src/infrastructure/schema/catalog.ts"))
        ? readText("apps/api/src/infrastructure/schema/catalog.ts")
        : "",
      existsSync(resolve(root, "packages/catalog/src/persistence/schema.ts"))
        ? readText("packages/catalog/src/persistence/schema.ts")
        : "",
    ].join("\n");

    expect(sources).toMatch(/sku/);
    expect(sources).toMatch(/member_price_cents/);
    expect(sources).toMatch(/list_price_cents/);
    expect(sources).toMatch(/web_wholesale/);
    expect(sources).toMatch(/web_retail/);
    expect(sources).toMatch(/tax_category_code/);
    expect(sources).toMatch(/country_of_origin|material/);
    expect(sources).toMatch(/inactive/);
    expect(sources).toMatch(/discontinued/);
    expect(sources).toMatch(/non_stock/);
    expect(sources).toMatch(/no_export/);
    expect(sources).toMatch(/currency/);

    for (const column of omittedProductColumns) {
      expect(sources).not.toMatch(new RegExp(`["']${column}["']`));
    }
  });

  it("relocates identifiers, packaging, categories, and image keys off the product row", () => {
    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/product_identifiers/);
    expect(sql).toMatch(/upc/);
    expect(sql).toMatch(/mfg/);
    expect(sql).toMatch(/alt/);
    expect(sql).toMatch(/product_packaging/);
    expect(sql).toMatch(/inner_pack_qty/);
    expect(sql).toMatch(/case_qty/);
    expect(sql).toMatch(/product_categories/);
    expect(sql).not.toMatch(/category_1/);
    expect(sql).toMatch(/product_images/);
    expect(sql).toMatch(/object_key/);
    expect(sql).not.toMatch(/bytea/i);
  });

  it("defines purchasing suppliers, terms, thin POs, and frozen PO lines", () => {
    const sql = readText("apps/api/drizzle/migrations/0000_catalog_purchasing_inventory.sql");
    expect(sql).toMatch(/vendor_number/);
    expect(sql).toMatch(/supplier_products/);
    expect(sql).toMatch(/last_po_cost_cents/);
    expect(sql).toMatch(/min_order_qty/);
    expect(sql).toMatch(/min_order_amount_cents/);
    expect(sql).not.toMatch(/standard_cost_cents/);
    expect(sql).toMatch(/purchase_orders/);
    expect(sql).toMatch(/purchase_order_lines/);
    expect(sql).not.toMatch(/document_number|po_status|g9/i);
  });

  it("defines inventory locations, reorder policies, locked movements, and generated available", () => {
    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/is_pick_bin/);
    expect(sql).toMatch(/reorder_policies/);
    expect(sql).toMatch(/min_on_hand/);
    expect(sql).toMatch(/max_on_hand/);
    expect(sql).toMatch(/InboundFromPo/);
    expect(sql).toMatch(/GoodsReceived/);
    expect(sql).toMatch(/Allocated/);
    expect(sql).toMatch(/Deallocated/);
    expect(sql).toMatch(/Shipped/);
    expect(sql).toMatch(/Adjustment/);
    expect(sql).toMatch(/purchase_order/);
    expect(sql).toMatch(/sales_order/);
    expect(sql).toMatch(
      /available[^,\n]*GENERATED ALWAYS AS \(on_hand - allocated\) STORED/i,
    );
    expect(sql).toMatch(/on_order/);
  });

  it("uses UUID PKs, integer qty, BIGINT cents + CHAR(3) currency, timestamptz", () => {
    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/uuid/i);
    expect(sql).toMatch(/integer/i);
    expect(sql).toMatch(/bigint/i);
    expect(sql).toMatch(/char\(3\)/i);
    expect(sql).toMatch(/timestamptz|timestamp with time zone/i);
    expect(sql).not.toMatch(/\b(float|real|double precision|numeric)\b/i);
  });

  it("records one additive Kit migration and keeps /ready as SELECT 1", () => {
    const journal = JSON.parse(
      readText("apps/api/drizzle/migrations/meta/_journal.json"),
    ) as { dialect: string; entries: unknown[] };
    expect(journal.dialect).toBe("postgresql");
    expect(journal.entries.length).toBeGreaterThanOrEqual(1);
    expect(journal.entries[0]).toBeDefined();

    const ready = readText("apps/api/src/infrastructure/db.ts");
    expect(ready).toContain("SELECT 1");
    expect(ready).not.toMatch(/migrate/i);

    const vitest = readText("vitest.config.ts");
    expect(vitest).not.toMatch(/docker|compose|db:migrate/i);
  });
});
