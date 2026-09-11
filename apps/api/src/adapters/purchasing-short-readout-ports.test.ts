import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryCommittedCustomerNamesListQuery,
  InMemorySalesOrderRepository,
} from "@dc-inventory/sales";
import {
  CustomerId,
  Money,
  OrderId,
  OrganizationId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { SalesOrderLineId } from "@dc-inventory/sales";
import { computeToOrder } from "@dc-inventory/inventory";
import { describe, expect, it } from "vitest";
import {
  committedCustomerNamesPort,
  inventoryToOrderReadPort,
} from "./purchasing-short-readout-ports.js";
import { createCatalogListQueryPgliteHarness } from "./support/catalog-list-query-pglite.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const SKU_A = Sku.parse("SHORT-A");
const SKU_B = Sku.parse("SHORT-B");
const CUSTOMER_A = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const CUSTOMER_B = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

async function seedCustomer(
  repo: InMemoryCustomerRepository,
  id: CustomerId,
  name: string,
): Promise<void> {
  await repo.save({
    id,
    organizationId: DEFAULT_ORG,
    name,
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
  });
}

async function seedSalesOrder(
  repo: InMemorySalesOrderRepository,
  options: {
    id: OrderId;
    customerId: CustomerId;
    status: "draft" | "confirmed" | "shipped" | "cancelled";
    sku: Sku;
    decommitted?: boolean;
  },
): Promise<void> {
  await repo.save({
    id: options.id,
    organizationId: DEFAULT_ORG,
    customerId: options.customerId,
    documentNumber: `SO-${String(options.id).slice(0, 8)}`,
    status: options.status,
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
    lines: [
      {
        id: SalesOrderLineId.parse("11111111-1111-4111-8111-111111111111"),
        sku: options.sku,
        name: "Line",
        qty: 5,
        unitPrice: Money.fromMinorUnits(100, "USD"),
        ...(options.decommitted ? { decommitted: true as const } : {}),
      },
    ],
  });
}

describe("inventoryToOrderReadPort", () => {
  it("loads toOrder for multiple SKUs in one stock_snapshots IN query", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const skuA = Sku.parse("UNCOVERED-BATCH-A");
      const skuB = Sku.parse("UNCOVERED-BATCH-B");
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, $3, 'Uncovered A', 'EA', 100, 50, true),
                ($4, $2, $5, 'Uncovered B', 'EA', 100, 50, true)`,
        [
          "da209000-0000-4000-8000-000000000801",
          OrganizationId.DEFAULT,
          skuA.value,
          "da209000-0000-4000-8000-000000000802",
          skuB.value,
        ],
      );
      await harness.client.query(
        `INSERT INTO inventory.stock_snapshots
          (organization_id, sku, location_id, on_hand, on_order, committed)
         VALUES ($1, $2, $3, 10, 5, 40),
                ($1, $4, $3, 0, 0, 25)`,
        [OrganizationId.DEFAULT, skuA.value, harness.locationId, skuB.value],
      );

      const port = inventoryToOrderReadPort(harness.db);
      const toOrder = await port.getToOrderBySkus(OrganizationId.DEFAULT, [
        skuA,
        skuB,
        Sku.parse("UNCOVERED-MISSING"),
      ]);

      expect(toOrder.get(skuA.value)).toBe(computeToOrder(40, 10, 5));
      expect(toOrder.get(skuB.value)).toBe(computeToOrder(25, 0, 0));
      expect(toOrder.get("UNCOVERED-MISSING")).toBe(0);
    } finally {
      await harness.close();
    }
  });

  it("returns toOrder 0 for every SKU when DEFAULT location is missing", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      await harness.client.query(`DELETE FROM inventory.stock_snapshots`);
      await harness.client.query(`DELETE FROM inventory.locations WHERE organization_id = $1`, [
        OrganizationId.DEFAULT,
      ]);

      const port = inventoryToOrderReadPort(harness.db);
      const sku = Sku.parse("NO-DEFAULT-LOC");
      const toOrder = await port.getToOrderBySkus(OrganizationId.DEFAULT, [sku]);

      expect(toOrder.get(sku.value)).toBe(0);
    } finally {
      await harness.close();
    }
  });
});

describe("committedCustomerNamesPort", () => {
  it("includes confirmed orders with live lines on requested SKUs and resolves customer names", async () => {
    const salesOrders = new InMemorySalesOrderRepository();
    const customers = new InMemoryCustomerRepository();
    await seedCustomer(customers, CUSTOMER_A, "Alpha Co");
    await seedCustomer(customers, CUSTOMER_B, "Beta Co");
    await seedSalesOrder(salesOrders, {
      id: OrderId.parse("22222222-2222-4222-8222-222222222222"),
      customerId: CUSTOMER_A,
      status: "confirmed",
      sku: SKU_A,
    });
    await seedSalesOrder(salesOrders, {
      id: OrderId.parse("33333333-3333-4333-8333-333333333333"),
      customerId: CUSTOMER_B,
      status: "confirmed",
      sku: SKU_B,
    });

    const port = committedCustomerNamesPort(
      new InMemoryCommittedCustomerNamesListQuery(salesOrders, customers),
    );
    const result = await port.listCommittedCustomerNames(DEFAULT_ORG, [SKU_A]);

    expect(result).toEqual([{ customerId: CUSTOMER_A, name: "Alpha Co" }]);
  });

  it("ignores non-confirmed orders", async () => {
    const salesOrders = new InMemorySalesOrderRepository();
    const customers = new InMemoryCustomerRepository();
    await seedCustomer(customers, CUSTOMER_A, "Alpha Co");
    await seedCustomer(customers, CUSTOMER_B, "Beta Co");
    await seedSalesOrder(salesOrders, {
      id: OrderId.parse("55555555-5555-4555-8555-555555555555"),
      customerId: CUSTOMER_B,
      status: "draft",
      sku: SKU_A,
    });
    await seedSalesOrder(salesOrders, {
      id: OrderId.parse("66666666-6666-4666-8666-666666666666"),
      customerId: CUSTOMER_B,
      status: "shipped",
      sku: SKU_A,
    });
    await seedSalesOrder(salesOrders, {
      id: OrderId.parse("77777777-7777-4777-8777-777777777777"),
      customerId: CUSTOMER_B,
      status: "cancelled",
      sku: SKU_A,
    });

    const port = committedCustomerNamesPort(
      new InMemoryCommittedCustomerNamesListQuery(salesOrders, customers),
    );
    const result = await port.listCommittedCustomerNames(DEFAULT_ORG, [SKU_A]);

    expect(result).toEqual([]);
  });

  it("matches confirmed lines even when the in-memory model marks them decommitted", async () => {
    const salesOrders = new InMemorySalesOrderRepository();
    const customers = new InMemoryCustomerRepository();
    await seedCustomer(customers, CUSTOMER_A, "Alpha Co");
    await seedSalesOrder(salesOrders, {
      id: OrderId.parse("44444444-4444-4444-8444-444444444444"),
      customerId: CUSTOMER_A,
      status: "confirmed",
      sku: SKU_A,
      decommitted: true,
    });

    const port = committedCustomerNamesPort(
      new InMemoryCommittedCustomerNamesListQuery(salesOrders, customers),
    );
    const result = await port.listCommittedCustomerNames(DEFAULT_ORG, [SKU_A]);

    expect(result).toEqual([{ customerId: CUSTOMER_A, name: "Alpha Co" }]);
  });
});
