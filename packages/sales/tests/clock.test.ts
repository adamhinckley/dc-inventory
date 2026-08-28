import {
  GetStockSnapshotUseCase,
  RecordAdjustmentIncreaseUseCase,
} from "@dc-inventory/inventory";
import { CustomerId, LocationId, OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemorySalesUnitOfWork } from "../src/adapters/in-memory-sales-unit-of-work.js";
import {
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  GetSalesOrderUseCase,
  ShipSalesOrderUseCase,
} from "../src/index.js";

const SKU = Sku.parse("SO-CLOCK-SKU");
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const FIXED = new Date("2021-06-15T12:00:00.000Z");

async function harness() {
  const clock = new InMemoryClock(FIXED);
  const uow = new InMemorySalesUnitOfWork(clock);
  const customers = {
    findById: async (organizationId: OrganizationId, id: CustomerId) =>
      organizationId === DEFAULT_ORG && id === CUSTOMER_ID ? { id } : null,
  };

  return {
    clock,
    uow,
    create: new CreateSalesOrderUseCase(uow.salesOrders, customers, clock),
    get: new GetSalesOrderUseCase(uow.salesOrders),
    confirm: new ConfirmSalesOrderUseCase(uow),
    ship: new ShipSalesOrderUseCase(uow),
    snapshot: new GetStockSnapshotUseCase(uow.inventoryReadModel),
    adjustmentIncrease: new RecordAdjustmentIncreaseUseCase(uow.ledger),
  };
}

describe("Sales seed clock (in-memory)", () => {
  it("creates, confirms, and ships with invoice-on-ship and omitted tax", async () => {
    const h = await harness();
    await h.uow.run(async () => {
      const stock = await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "clock-seed-stock",
        sku: SKU,
        quantity: 8,
        refType: "adjustment",
        refId: "clock-seed",
      });
      expect(stock.ok).toBe(true);
    });

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 3, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.salesOrder.documentNumber).toBe("SO-00001");

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "clock-confirm",
    });
    expect(confirmed.ok).toBe(true);

    const shipped = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "clock-ship",
    });
    expect(shipped.ok).toBe(true);
    if (!shipped.ok) {
      return;
    }
    expect(shipped.salesOrder.status).toBe("shipped");

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(5);
    expect(snap.allocated).toBe(0);

    const invoice = await h.uow.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id);
    expect(invoice).not.toBeNull();
    expect(invoice?.taxTotal.amountMinor).toBe(0);
    expect(invoice?.total.amountMinor).toBe(1500);
    expect(invoice?.documentNumber).toBe("INV-00001");
  });

  it("persists the injected posting instant on the invoice created at ship", async () => {
    const h = await harness();
    await h.uow.run(async () => {
      const stock = await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "clock-seed-stock-posted",
        sku: SKU,
        quantity: 8,
        refType: "adjustment",
        refId: "clock-seed-posted",
      });
      expect(stock.ok).toBe(true);
    });

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 3, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "clock-confirm-posted",
    });
    expect(confirmed.ok).toBe(true);

    const shipped = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "clock-ship-posted",
    });
    expect(shipped.ok).toBe(true);

    const invoice = await h.uow.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id);
    expect(invoice).not.toBeNull();
    expect(invoice?.postedAt?.getTime()).toBe(FIXED.getTime());
  });

  it("persists the injected creation instant on a sales order", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 1, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const loaded = await h.get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.salesOrder.createdAt.getTime()).toBe(FIXED.getTime());
  });
});
