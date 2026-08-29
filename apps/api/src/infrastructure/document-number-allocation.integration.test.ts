import {
  DrizzleInvoiceRepository,
  type AccountingDrizzle,
} from "@dc-inventory/accounting";
import {
  DrizzlePurchaseOrderRepository,
  PurchaseOrderLineId,
  type PurchasingDrizzle,
} from "@dc-inventory/purchasing";
import {
  DrizzleSalesOrderRepository,
  SalesOrderLineId,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "./db.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeWithDatabase = databaseUrl === undefined || databaseUrl === ""
  ? describe.skip
  : describe;

const ORGANIZATION_ID = OrganizationId.parse("760e8400-e29b-41d4-a716-446655440208");
const CUSTOMER_ID = CustomerId.parse("20800000-0000-4000-8000-000000000001");
const SUPPLIER_ID = SupplierId.parse("20800000-0000-4000-8000-000000000002");
const CREATED_AT = new Date("2026-08-29T00:00:00.000Z");
const ZERO = Money.fromMinorUnits(0, "USD");
const SUBTOTAL = Money.fromMinorUnits(1000, "USD");

let first: DatabaseConnection;
let second: DatabaseConnection;

async function cleanFixtures(connection: DatabaseConnection): Promise<void> {
  await connection.sql`
    DELETE FROM accounting.invoices
    WHERE organization_id = ${ORGANIZATION_ID}
  `;
  await connection.sql`
    DELETE FROM sales.order_lines
    WHERE order_id IN (
      SELECT id FROM sales.orders WHERE organization_id = ${ORGANIZATION_ID}
    )
  `;
  await connection.sql`
    DELETE FROM sales.orders
    WHERE organization_id = ${ORGANIZATION_ID}
  `;
  await connection.sql`
    DELETE FROM purchasing.purchase_order_lines
    WHERE purchase_order_id IN (
      SELECT id FROM purchasing.purchase_orders
      WHERE organization_id = ${ORGANIZATION_ID}
    )
  `;
  await connection.sql`
    DELETE FROM purchasing.purchase_orders
    WHERE organization_id = ${ORGANIZATION_ID}
  `;
  await connection.sql`
    DELETE FROM accounting.document_number_counters
    WHERE organization_id = ${ORGANIZATION_ID}
  `;
  await connection.sql`
    DELETE FROM sales.document_number_counters
    WHERE organization_id = ${ORGANIZATION_ID}
  `;
  await connection.sql`
    DELETE FROM purchasing.document_number_counters
    WHERE organization_id = ${ORGANIZATION_ID}
  `;
  await connection.sql`DELETE FROM purchasing.suppliers WHERE id = ${SUPPLIER_ID}`;
  await connection.sql`DELETE FROM customers.customers WHERE id = ${CUSTOMER_ID}`;
}

function purchaseOrder(index: number) {
  return {
    id: PurchaseOrderId.parse(`20800000-0000-4000-8001-${String(index).padStart(12, "0")}`),
    organizationId: ORGANIZATION_ID,
    supplierId: SUPPLIER_ID,
    status: "draft" as const,
    shipDate: null,
    cancelDate: null,
    createdAt: CREATED_AT,
    lines: [
      {
        id: PurchaseOrderLineId.parse(
          `20800000-0000-4000-8101-${String(index).padStart(12, "0")}`,
        ),
        sku: Sku.parse(`ADA-208-PO-${index}`),
        name: `PO line ${index}`,
        qty: 1,
        receivedQty: 0,
      },
    ],
  };
}

function salesOrder(index: number) {
  return {
    id: OrderId.parse(`20800000-0000-4000-8002-${String(index).padStart(12, "0")}`),
    organizationId: ORGANIZATION_ID,
    customerId: CUSTOMER_ID,
    status: "draft" as const,
    createdAt: CREATED_AT,
    lines: [
      {
        id: SalesOrderLineId.parse(
          `20800000-0000-4000-8102-${String(index).padStart(12, "0")}`,
        ),
        sku: Sku.parse(`ADA-208-SO-${index}`),
        name: `Sales line ${index}`,
        qty: 1,
        unitPrice: SUBTOTAL,
      },
    ],
  };
}

function invoice(index: number, orderId: OrderId) {
  return {
    id: InvoiceId.parse(`20800000-0000-4000-8003-${String(index).padStart(12, "0")}`),
    organizationId: ORGANIZATION_ID,
    orderId,
    customerId: CUSTOMER_ID,
    status: "posted" as const,
    postedAt: CREATED_AT,
    subtotal: SUBTOTAL,
    taxTotal: ZERO,
    total: SUBTOTAL,
  };
}

describeWithDatabase("atomic document-number allocation", () => {
  beforeAll(async () => {
    first = createDatabaseConnection(databaseUrl);
    second = createDatabaseConnection(databaseUrl);
    await cleanFixtures(first);
    await first.sql`
      INSERT INTO customers.customers
        (id, organization_id, name, credit_limit_cents, currency, terms)
      VALUES (${CUSTOMER_ID}, ${ORGANIZATION_ID}, 'ADA-208 customer', 100000, 'USD', 'NET30')
    `;
    await first.sql`
      INSERT INTO purchasing.suppliers
        (id, organization_id, vendor_number, name)
      VALUES (${SUPPLIER_ID}, ${ORGANIZATION_ID}, 'ADA-208', 'ADA-208 supplier')
    `;
  });

  afterAll(async () => {
    if (first !== undefined) {
      await cleanFixtures(first);
      await first.sql.end({ timeout: 5 });
    }
    if (second !== undefined) {
      await second.sql.end({ timeout: 5 });
    }
  });

  it("allocates unique PO numbers across two connections and reuses a rolled-back number", async () => {
    const firstRepo = new DrizzlePurchaseOrderRepository(first.db as PurchasingDrizzle);
    const secondRepo = new DrizzlePurchaseOrderRepository(second.db as PurchasingDrizzle);

    const concurrent = await Promise.all([
      firstRepo.insertWithNextDocumentNumber(purchaseOrder(1)),
      secondRepo.insertWithNextDocumentNumber(purchaseOrder(2)),
    ]);
    expect(concurrent.map((row) => row.documentNumber).sort()).toEqual([
      "PO-00001",
      "PO-00002",
    ]);

    await expect(
      first.db.transaction(async (tx) => {
        const repo = new DrizzlePurchaseOrderRepository(tx as PurchasingDrizzle);
        await repo.insertWithNextDocumentNumber(purchaseOrder(3));
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    const retried = await secondRepo.insertWithNextDocumentNumber(purchaseOrder(4));
    expect(retried.documentNumber).toBe("PO-00003");
  });

  it("allocates unique sales-order numbers across two connections and reuses a rolled-back number", async () => {
    const firstRepo = new DrizzleSalesOrderRepository(first.db as SalesDrizzle);
    const secondRepo = new DrizzleSalesOrderRepository(second.db as SalesDrizzle);

    const concurrent = await Promise.all([
      firstRepo.insertWithNextDocumentNumber(salesOrder(1)),
      secondRepo.insertWithNextDocumentNumber(salesOrder(2)),
    ]);
    expect(concurrent.map((row) => row.documentNumber).sort()).toEqual([
      "SO-00001",
      "SO-00002",
    ]);

    await expect(
      first.db.transaction(async (tx) => {
        const repo = new DrizzleSalesOrderRepository(tx as SalesDrizzle);
        await repo.insertWithNextDocumentNumber(salesOrder(3));
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    const retried = await secondRepo.insertWithNextDocumentNumber(salesOrder(4));
    expect(retried.documentNumber).toBe("SO-00003");
  });

  it("allocates unique invoice numbers across two connections and reuses a rolled-back number", async () => {
    const salesRepo = new DrizzleSalesOrderRepository(first.db as SalesDrizzle);
    const parentOrders = await Promise.all([
      salesRepo.insertWithNextDocumentNumber(salesOrder(5)),
      salesRepo.insertWithNextDocumentNumber(salesOrder(6)),
      salesRepo.insertWithNextDocumentNumber(salesOrder(7)),
      salesRepo.insertWithNextDocumentNumber(salesOrder(8)),
    ]);
    const firstRepo = new DrizzleInvoiceRepository(first.db as AccountingDrizzle);
    const secondRepo = new DrizzleInvoiceRepository(second.db as AccountingDrizzle);

    const concurrent = await Promise.all([
      firstRepo.insertWithNextDocumentNumber(invoice(1, parentOrders[0]!.id)),
      secondRepo.insertWithNextDocumentNumber(invoice(2, parentOrders[1]!.id)),
    ]);
    expect(concurrent.map((row) => row.documentNumber).sort()).toEqual([
      "INV-00001",
      "INV-00002",
    ]);

    await expect(
      first.db.transaction(async (tx) => {
        const repo = new DrizzleInvoiceRepository(tx as AccountingDrizzle);
        await repo.insertWithNextDocumentNumber(invoice(3, parentOrders[2]!.id));
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    const retried = await secondRepo.insertWithNextDocumentNumber(
      invoice(4, parentOrders[3]!.id),
    );
    expect(retried.documentNumber).toBe("INV-00003");
  });
});
