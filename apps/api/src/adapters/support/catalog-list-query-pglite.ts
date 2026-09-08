import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { InMemoryClock } from "@dc-inventory/identity";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { CatalogInventoryListQuery } from "../catalog-inventory-list-query.js";
import { schema } from "../../infrastructure/schema.js";
import type { AppDrizzle } from "../../infrastructure/db.js";

const ORG = OrganizationId.DEFAULT;
const PRODUCT_ID = "da209000-0000-4000-8000-000000000101";
const OTHER_PRODUCT_ID = "da209000-0000-4000-8000-000000000105";
const SUPPLIER_ID = "da209000-0000-4000-8000-000000000102";
const OTHER_SUPPLIER_ID = "da209000-0000-4000-8000-000000000106";
const SUPPLIER_PRODUCT_ID = "da209000-0000-4000-8000-000000000103";
const LOCATION_ID = "da209000-0000-4000-8000-000000000104";
const SKU = "LAST-PO-COST-500";
const OTHER_SKU = "OTHER-FACTORY-SKU";

async function execCatalogListQuerySchema(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE SCHEMA catalog;
    CREATE SCHEMA inventory;
    CREATE SCHEMA purchasing;

    CREATE TABLE catalog.products (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      sku text NOT NULL,
      name text NOT NULL,
      description text,
      uom text NOT NULL,
      country_of_origin text,
      material text,
      length text,
      width text,
      height text,
      diameter text,
      size text,
      weight text,
      weight_uom text,
      member_price_cents bigint NOT NULL,
      list_price_cents bigint,
      original_wholesale_price_cents bigint,
      currency char(3) NOT NULL DEFAULT 'USD',
      catalog_page text,
      default_order_qty integer,
      default_weight text,
      default_weight_uom text,
      inactive boolean NOT NULL DEFAULT false,
      discontinued boolean NOT NULL DEFAULT false,
      non_stock boolean NOT NULL DEFAULT false,
      no_export boolean NOT NULL DEFAULT false,
      web_wholesale boolean NOT NULL DEFAULT false,
      web_retail boolean NOT NULL DEFAULT false,
      tax_category_code text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, sku)
    );

    CREATE TABLE catalog.product_packaging (
      id uuid PRIMARY KEY,
      product_id uuid NOT NULL UNIQUE REFERENCES catalog.products(id),
      case_qty integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE inventory.locations (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      code text NOT NULL,
      is_pick_bin boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, code)
    );

    CREATE TABLE inventory.stock_snapshots (
      organization_id text NOT NULL,
      sku text NOT NULL,
      location_id uuid NOT NULL REFERENCES inventory.locations(id),
      on_hand integer NOT NULL DEFAULT 0,
      allocated integer NOT NULL DEFAULT 0,
      on_order integer NOT NULL DEFAULT 0,
      committed integer NOT NULL DEFAULT 0,
      sticky_locked boolean NOT NULL DEFAULT false,
      window_opens_at timestamptz,
      window_closes_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, sku, location_id)
    );

    CREATE TABLE purchasing.suppliers (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      vendor_number text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, vendor_number)
    );

    CREATE TABLE purchasing.supplier_products (
      id uuid PRIMARY KEY,
      supplier_id uuid NOT NULL REFERENCES purchasing.suppliers(id),
      sku text NOT NULL,
      supplier_sku text,
      min_order_qty integer,
      min_order_amount_cents bigint,
      last_po_cost_cents bigint,
      currency char(3) NOT NULL DEFAULT 'USD',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (supplier_id, sku)
    );

    CREATE TYPE inventory.sell_window_status AS ENUM ('scheduled', 'open', 'closed');

    CREATE TABLE inventory.sell_windows (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      name text NOT NULL,
      filter_snapshot jsonb NOT NULL,
      window_opens_at timestamptz,
      window_closes_at timestamptz NOT NULL,
      status inventory.sell_window_status NOT NULL,
      manually_closed_at timestamptz,
      applied_by text NOT NULL,
      applied_at timestamptz NOT NULL,
      sku_count integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE inventory.sell_window_skus (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      sell_window_id uuid NOT NULL REFERENCES inventory.sell_windows(id),
      sku text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, sell_window_id, sku)
    );
  `);
}

export async function createCatalogListQueryPgliteHarness() {
  const client = new PGlite();
  await execCatalogListQuerySchema(client);

  await client.query(
    `INSERT INTO catalog.products
      (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
     VALUES ($1, $2, $3, 'Widget with last PO cost', 'EA', 1000, 500, true)`,
    [PRODUCT_ID, ORG, SKU],
  );
  await client.query(
    `INSERT INTO inventory.locations (id, organization_id, code)
     VALUES ($1, $2, 'DEFAULT')`,
    [LOCATION_ID, ORG],
  );
  await client.query(
    `INSERT INTO inventory.stock_snapshots
      (organization_id, sku, location_id, on_hand, allocated, on_order, committed)
     VALUES ($1, $2, $3, 3, 0, 0, 0)`,
    [ORG, SKU, LOCATION_ID],
  );
  await client.query(
    `INSERT INTO purchasing.suppliers (id, organization_id, vendor_number, name)
     VALUES ($1, $2, 'VEND-500', 'Acme Supply')`,
    [SUPPLIER_ID, ORG],
  );
  await client.query(
    `INSERT INTO purchasing.supplier_products
      (id, supplier_id, sku, supplier_sku, last_po_cost_cents)
     VALUES ($1, $2, $3, 'ACME-500', $4::bigint)`,
    [SUPPLIER_PRODUCT_ID, SUPPLIER_ID, SKU, 500],
  );
  await client.query(
    `INSERT INTO catalog.products
      (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
     VALUES ($1, $2, $3, 'Other factory widget', 'EA', 800, 400, true)`,
    [OTHER_PRODUCT_ID, ORG, OTHER_SKU],
  );
  await client.query(
    `INSERT INTO purchasing.suppliers (id, organization_id, vendor_number, name)
     VALUES ($1, $2, 'VEND-OTHER', 'Other Supply')`,
    [OTHER_SUPPLIER_ID, ORG],
  );
  await client.query(
    `INSERT INTO purchasing.supplier_products
      (id, supplier_id, sku)
     VALUES ($1, $2, $3)`,
    ["da209000-0000-4000-8000-000000000107", OTHER_SUPPLIER_ID, OTHER_SKU],
  );

  const db = drizzle(client, { schema }) as unknown as AppDrizzle;
  const clock = new InMemoryClock(new Date("2026-09-03T12:00:00.000Z"));
  const catalogListQuery = new CatalogInventoryListQuery(db, clock);

  return {
    catalogListQuery,
    client,
    db,
    clock,
    locationId: LOCATION_ID,
    supplierId: SUPPLIER_ID,
    otherSupplierId: OTHER_SUPPLIER_ID,
    sku: SKU,
    async close(): Promise<void> {
      await client.close();
    },
  };
}
