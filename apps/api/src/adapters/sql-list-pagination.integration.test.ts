import { DrizzlePurchaseOrderRepository } from "@dc-inventory/purchasing";
import { DrizzleSalesOrderRepository } from "@dc-inventory/sales";
import {
  CustomerId,
  OrganizationId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CatalogInventoryListQuery } from "./catalog-inventory-list-query.js";
import { schema } from "../infrastructure/schema.js";

const databaseUrl = process.env.DATABASE_URL;
const ORG = OrganizationId.parse("da209000-0000-4000-8000-000000000001");
const CUSTOMER_ID = CustomerId.parse("da209000-0000-4000-8000-000000000002");
const SUPPLIER_ID = SupplierId.parse("da209000-0000-4000-8000-000000000003");
const LOCATION_ID = "da209000-0000-4000-8000-000000000004";
const PRODUCT_IDS = Array.from(
  { length: 5 },
  (_, index) => `da209000-0000-4000-8000-0000000001${String(index + 1).padStart(2, "0")}`,
);
const SALES_ORDER_IDS = Array.from(
  { length: 5 },
  (_, index) => `da209000-0000-4000-8000-0000000002${String(index + 1).padStart(2, "0")}`,
);
const PURCHASE_ORDER_IDS = Array.from(
  { length: 5 },
  (_, index) => `da209000-0000-4000-8000-0000000003${String(index + 1).padStart(2, "0")}`,
);

describe.skipIf(databaseUrl === undefined)("PostgreSQL list pagination", () => {
  let queryCount = 0;
  const sql = postgres(databaseUrl!, {
    max: 2,
    debug: () => {
      queryCount += 1;
    },
  });
  const db = drizzle(sql, { schema });

  beforeAll(async () => {
    await sql`delete from sales.order_lines where order_id in ${sql(SALES_ORDER_IDS)}`;
    await sql`delete from sales.orders where id in ${sql(SALES_ORDER_IDS)}`;
    await sql`delete from purchasing.purchase_order_lines where purchase_order_id in ${sql(PURCHASE_ORDER_IDS)}`;
    await sql`delete from purchasing.purchase_orders where id in ${sql(PURCHASE_ORDER_IDS)}`;
    await sql`delete from inventory.stock_snapshots where organization_id = ${ORG}`;
    await sql`delete from inventory.locations where id = ${LOCATION_ID}`;
    await sql`delete from catalog.products where organization_id = ${ORG}`;
    await sql`delete from customers.customers where id = ${CUSTOMER_ID}`;
    await sql`delete from purchasing.suppliers where id = ${SUPPLIER_ID}`;

    await sql`
      insert into customers.customers
        (id, organization_id, name, credit_limit_cents, currency, terms)
      values (${CUSTOMER_ID}, ${ORG}, 'ADA-209 customer', 100000, 'USD', 'NET30')
    `;
    await sql`
      insert into purchasing.suppliers (id, organization_id, vendor_number, name)
      values (${SUPPLIER_ID}, ${ORG}, 'ADA209', 'ADA-209 supplier')
    `;
    await sql`
      insert into inventory.locations (id, organization_id, code)
      values (${LOCATION_ID}, ${ORG}, 'DEFAULT')
    `;

    for (let index = 0; index < 5; index += 1) {
      const productId = PRODUCT_IDS[index]!;
      const salesOrderId = SALES_ORDER_IDS[index]!;
      const purchaseOrderId = PURCHASE_ORDER_IDS[index]!;
      const sku = `ADA209-${index + 1}`;
      await sql`
        insert into catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, currency, web_wholesale)
        values (${productId}, ${ORG}, ${sku}, 'Equal name', 'EA', 100, 'USD', true)
      `;
      await sql`
        insert into inventory.stock_snapshots
          (organization_id, sku, location_id, on_hand, allocated, on_order)
        values (${ORG}, ${sku}, ${LOCATION_ID}, ${index < 4 ? 7 : 9}, 0, 0)
      `;
      await sql`
        insert into sales.orders
          (id, organization_id, customer_id, status, document_number)
        values (
          ${salesOrderId},
          ${ORG},
          ${CUSTOMER_ID},
          'draft',
          ${`SO-ADA209-${index + 1}`}
        )
      `;
      await sql`
        insert into sales.order_lines
          (order_id, sku, name, qty, unit_price_cents, currency)
        values (${salesOrderId}, ${sku}, 'Line', 1, 100, 'USD')
      `;
      await sql`
        insert into purchasing.purchase_orders
          (id, organization_id, supplier_id, status, document_number)
        values (
          ${purchaseOrderId},
          ${ORG},
          ${SUPPLIER_ID},
          'draft',
          ${`PO-ADA209-${index + 1}`}
        )
      `;
      await sql`
        insert into purchasing.purchase_order_lines
          (purchase_order_id, sku, name, qty, received_qty)
        values (${purchaseOrderId}, ${sku}, 'Line', 1, 0)
      `;
    }
  });

  afterAll(async () => {
    await sql`delete from sales.order_lines where order_id in ${sql(SALES_ORDER_IDS)}`;
    await sql`delete from sales.orders where id in ${sql(SALES_ORDER_IDS)}`;
    await sql`delete from purchasing.purchase_order_lines where purchase_order_id in ${sql(PURCHASE_ORDER_IDS)}`;
    await sql`delete from purchasing.purchase_orders where id in ${sql(PURCHASE_ORDER_IDS)}`;
    await sql`delete from inventory.stock_snapshots where organization_id = ${ORG}`;
    await sql`delete from inventory.locations where id = ${LOCATION_ID}`;
    await sql`delete from catalog.products where organization_id = ${ORG}`;
    await sql`delete from customers.customers where id = ${CUSTOMER_ID}`;
    await sql`delete from purchasing.suppliers where id = ${SUPPLIER_ID}`;
    await sql.end({ timeout: 5 });
  });

  it("keeps equal stock sorts stable on the second catalog page", async () => {
    const adapter = new CatalogInventoryListQuery(db);
    queryCount = 0;
    const firstRead = await adapter.list({
      organizationId: ORG,
      page: 2,
      pageSize: 2,
      sortBy: "onHand",
      sortOrder: "asc",
    });
    expect(queryCount).toBe(2);
    expect(firstRead.total).toBe(5);
    expect(firstRead.items).toHaveLength(2);
    expect(firstRead.items.map((row) => row.product.id)).toEqual(PRODUCT_IDS.slice(2, 4));

    queryCount = 0;
    const secondRead = await adapter.list({
      organizationId: ORG,
      page: 2,
      pageSize: 2,
      sortBy: "onHand",
      sortOrder: "asc",
    });
    expect(queryCount).toBe(2);
    expect(secondRead.items.map((row) => row.product.id)).toEqual(
      firstRead.items.map((row) => row.product.id),
    );
  });

  it("pages sales headers in SQL and batch-loads only the page's lines", async () => {
    const adapter = new DrizzleSalesOrderRepository(db);
    queryCount = 0;
    const page = await adapter.list({
      organizationId: ORG,
      customerId: CUSTOMER_ID,
      page: 2,
      pageSize: 2,
    });
    expect(queryCount).toBe(3);
    expect(page.total).toBe(5);
    expect(page.items.map((order) => order.id)).toEqual(SALES_ORDER_IDS.slice(2, 4));
    expect(page.items).toHaveLength(2);
    expect(page.items.every((order) => order.lines.length === 1)).toBe(true);
  });

  it("pages PO headers in SQL and batch-loads only the page's lines", async () => {
    const adapter = new DrizzlePurchaseOrderRepository(db);
    queryCount = 0;
    const page = await adapter.list({
      organizationId: ORG,
      supplierId: SUPPLIER_ID,
      page: 2,
      pageSize: 2,
    });
    expect(queryCount).toBe(3);
    expect(page.total).toBe(5);
    expect(page.items.map((order) => order.id)).toEqual(PURCHASE_ORDER_IDS.slice(2, 4));
    expect(page.items).toHaveLength(2);
    expect(page.items.every((order) => order.lines.length === 1)).toBe(true);
  });
});
