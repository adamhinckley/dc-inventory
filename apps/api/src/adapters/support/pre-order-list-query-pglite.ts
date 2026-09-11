import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { PreOrderInventoryListQuery } from "../pre-order-inventory-list-query.js";
import { schema } from "../../infrastructure/schema.js";
import type { AppDrizzle } from "../../infrastructure/db.js";

const ORG = OrganizationId.DEFAULT;
const LOCATION_ID = "da209000-0000-4000-8000-000000000104";
const SUPPLIER_A = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SUPPLIER_B = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU_A = Sku.parse("UNCOVERED-SQL-A");
const SKU_B = Sku.parse("UNCOVERED-SQL-B");
const SKU_UNMAPPED = Sku.parse("UNCOVERED-SQL-X");
const PO_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PO_LINE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

async function execPreOrderListQuerySchema(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE SCHEMA inventory;
    CREATE SCHEMA purchasing;

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
      po_prefix text,
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

    CREATE TYPE purchasing.po_status AS ENUM ('draft', 'submitted', 'received', 'cancelled');

    CREATE TABLE purchasing.purchase_orders (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      supplier_id uuid NOT NULL REFERENCES purchasing.suppliers(id),
      status purchasing.po_status NOT NULL DEFAULT 'draft',
      document_number text NOT NULL,
      ship_date date,
      cancel_date date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, document_number)
    );

    CREATE INDEX purchase_orders_organization_id_status_idx
      ON purchasing.purchase_orders (organization_id, status);

    CREATE TABLE purchasing.purchase_order_lines (
      id uuid PRIMARY KEY,
      purchase_order_id uuid NOT NULL REFERENCES purchasing.purchase_orders(id),
      sku text NOT NULL,
      name text NOT NULL,
      qty integer NOT NULL,
      received_qty integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function createPreOrderListQueryPgliteHarness() {
  const client = new PGlite();
  await execPreOrderListQuerySchema(client);

  await client.query(
    `INSERT INTO inventory.locations (id, organization_id, code) VALUES ($1, $2, 'DEFAULT')`,
    [LOCATION_ID, ORG],
  );
  await client.query(
    `INSERT INTO purchasing.suppliers (id, organization_id, vendor_number, name, po_prefix)
     VALUES ($1, $2, 'V-A', 'Factory A', 'FA'),
            ($3, $2, 'V-B', 'Factory B', NULL)`,
    [SUPPLIER_A, ORG, SUPPLIER_B],
  );
  await client.query(
    `INSERT INTO purchasing.supplier_products (id, supplier_id, sku)
     VALUES (gen_random_uuid(), $1, $3),
            (gen_random_uuid(), $2, $4)`,
    [SUPPLIER_A, SUPPLIER_B, SKU_A.value, SKU_B.value],
  );
  for (const [sku, committed] of [
    [SKU_A.value, 120],
    [SKU_B.value, 40],
    [SKU_UNMAPPED.value, 25],
  ] as const) {
    await client.query(
      `INSERT INTO inventory.stock_snapshots
        (organization_id, sku, location_id, on_hand, allocated, on_order, committed)
       VALUES ($1, $2, $3, 0, 0, 0, $4)`,
      [ORG, sku, LOCATION_ID, committed],
    );
  }
  await client.query(
    `INSERT INTO purchasing.purchase_orders
      (id, organization_id, supplier_id, status, document_number)
     VALUES ($1, $2, $3, 'draft', 'PO-00042')`,
    [PO_ID, ORG, SUPPLIER_A],
  );
  await client.query(
    `INSERT INTO purchasing.purchase_order_lines
      (id, purchase_order_id, sku, name, qty)
     VALUES ($1, $2, $3, 'Widget', 10)`,
    [PO_LINE_ID, PO_ID, SKU_A.value],
  );

  const db = drizzle(client, { schema }) as unknown as AppDrizzle;
  const preOrderList = new PreOrderInventoryListQuery(db);

  return {
    preOrderList,
    client,
    async close(): Promise<void> {
      await client.close();
    },
  };
}

export const preOrderListQueryPgliteIds = {
  org: ORG,
  supplierA: SUPPLIER_A,
  supplierB: SUPPLIER_B,
  skuA: SKU_A,
  skuB: SKU_B,
  skuUnmapped: SKU_UNMAPPED,
};
