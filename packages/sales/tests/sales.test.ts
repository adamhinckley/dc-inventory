import {
  GetStockSnapshotUseCase,
  RecordAdjustmentIncreaseUseCase,
} from "@dc-inventory/inventory";
import { CustomerId, LocationId, Money, OrganizationId, OrderId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemorySalesUnitOfWork } from "../src/adapters/in-memory-sales-unit-of-work.js";
import {
  CancelSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  ListSalesOrdersUseCase,
  ShipSalesOrderUseCase,
} from "../src/index.js";
import { newUuid, SalesOrderLineId } from "../src/domain/ids.js";
import type { ISalesUnitOfWork } from "../src/domain/ports/sales-order-repository.js";

const SKU = Sku.parse("SO-TEST-SKU");
const SKU_B = Sku.parse("SO-TEST-SKU-B");
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const BETA_CUSTOMER_ID = CustomerId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

async function harness() {
  const uow = new InMemorySalesUnitOfWork();
  const customers = {
    findById: async (organizationId: OrganizationId, id: CustomerId) => {
      if (organizationId === DEFAULT_ORG && id === CUSTOMER_ID) {
        return { id };
      }
      if (organizationId === BETA_ORG && id === BETA_CUSTOMER_ID) {
        return { id };
      }
      return null;
    },
  };

  return {
    uow,
    customers,
    create: new CreateSalesOrderUseCase(uow.salesOrders, customers),
    list: new ListSalesOrdersUseCase(uow.salesOrders),
    confirm: new ConfirmSalesOrderUseCase(uow),
    cancel: new CancelSalesOrderUseCase(uow),
    ship: new ShipSalesOrderUseCase(uow),
    snapshot: new GetStockSnapshotUseCase(uow.inventoryReadModel),
    adjustmentIncrease: new RecordAdjustmentIncreaseUseCase(uow.ledger),
  };
}

async function seedStock(
  h: Awaited<ReturnType<typeof harness>>,
  sku: Sku,
  quantity: number,
) {
  await h.uow.run(async () => {
    const result = await h.adjustmentIncrease.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: `seed-${sku.value}-${quantity}`,
      sku,
      quantity,
      refType: "adjustment",
      refId: `seed-${sku.value}`,
    });
    expect(result.ok).toBe(true);
  });
}

describe("Sales (in-memory)", () => {
  it("assigns SO-00001 document numbers with gaps allowed after cancel", async () => {
    const h = await harness();
    const first = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 2, unitPriceCents: 500, currency: "USD" }],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.salesOrder.documentNumber).toBe("SO-00001");

    await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: first.salesOrder.id,
      idempotencyKey: "cancel-draft",
    });

    const second = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 1, unitPriceCents: 500, currency: "USD" }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.salesOrder.documentNumber).toBe("SO-00002");

    const sorted = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "status",
      sortOrder: "asc",
    });
    expect(sorted.items.map((order) => order.status)).toEqual(["cancelled", "draft"]);

    const searched = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      q: "00002",
      page: 1,
      pageSize: 25,
      sortBy: "documentNumber",
      sortOrder: "desc",
      status: "draft",
      customerId: CUSTOMER_ID,
    });
    expect(searched.items.map((order) => order.documentNumber)).toEqual(["SO-00002"]);
  });

  it("merges duplicate SKU lines at create", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { sku: SKU.value, name: "Widget", qty: 2, unitPriceCents: 500, currency: "USD" },
        { sku: SKU.value, name: "Widget", qty: 3, unitPriceCents: 500, currency: "USD" },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.salesOrder.lines).toHaveLength(1);
    expect(created.salesOrder.lines[0]?.qty).toBe(5);
  });

  it("rejects empty orders and non-positive lines", async () => {
    const h = await harness();
    const empty = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [],
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) {
      return;
    }
    expect(empty.reason).toBe("empty_order");

    const zero = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 0, unitPriceCents: 500, currency: "USD" }],
    });
    expect(zero.ok).toBe(false);
  });

  it("allows draft quantity over available", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 100, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.available).toBe(0);
  });

  it("confirms with all-or-nothing ATP and allocates inventory", async () => {
    const h = await harness();
    await seedStock(h, SKU, 10);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { sku: SKU.value, name: "Widget", qty: 4, unitPriceCents: 500, currency: "USD" },
        { sku: SKU_B.value, name: "Gadget", qty: 3, unitPriceCents: 700, currency: "USD" },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await seedStock(h, SKU_B, 2);

    const failed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-short",
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) {
      return;
    }
    expect(failed.reason).toBe("insufficient_atp");

    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(reloaded?.status).toBe("draft");

    await seedStock(h, SKU_B, 1);
    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-ok",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.salesOrder.status).toBe("confirmed");

    const snapA = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snapA.allocated).toBe(4);
    expect(snapA.available).toBe(6);
    const snapB = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU_B, locationId: DEFAULT });
    expect(snapB.allocated).toBe(3);
    expect(snapB.available).toBe(0);
  });

  it("cancels confirmed orders with deallocation", async () => {
    const h = await harness();
    await seedStock(h, SKU, 8);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 5, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-cancel",
    });

    const cancelled = await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "cancel-confirmed",
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }
    expect(cancelled.salesOrder.status).toBe("cancelled");

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.allocated).toBe(0);
    expect(snap.available).toBe(8);
  });

  it("prevents two confirms that together exceed available", async () => {
    const h = await harness();
    await seedStock(h, SKU, 5);

    const firstOrder = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 4, unitPriceCents: 500, currency: "USD" }],
    });
    const secondOrder = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 4, unitPriceCents: 500, currency: "USD" }],
    });
    expect(firstOrder.ok).toBe(true);
    expect(secondOrder.ok).toBe(true);
    if (!firstOrder.ok || !secondOrder.ok) {
      return;
    }

    const firstConfirm = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: firstOrder.salesOrder.id,
      idempotencyKey: "confirm-a",
    });
    expect(firstConfirm.ok).toBe(true);

    const secondConfirm = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: secondOrder.salesOrder.id,
      idempotencyKey: "confirm-b",
    });
    expect(secondConfirm.ok).toBe(false);
    if (secondConfirm.ok) {
      return;
    }
    expect(secondConfirm.reason).toBe("insufficient_atp");
  });

  it("ships confirmed orders atomically with zero-tax invoice", async () => {
    const h = await harness();
    await seedStock(h, SKU, 10);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { sku: SKU.value, name: "Widget", qty: 4, unitPriceCents: 500, currency: "USD" },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-ship",
    });

    const shipped = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-once",
    });
    expect(shipped.ok).toBe(true);
    if (!shipped.ok) {
      return;
    }
    expect(shipped.salesOrder.status).toBe("shipped");

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.allocated).toBe(0);
    expect(snap.onHand).toBe(6);
    expect(snap.available).toBe(6);

    const invoice = await h.uow.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id);
    expect(invoice).not.toBeNull();
    expect(invoice?.taxTotal.amountMinor).toBe(0);
    expect(invoice?.total.amountMinor).toBe(2000);
    expect(invoice?.subtotal.amountMinor).toBe(2000);
    expect(invoice?.documentNumber).toBe("INV-00001");
  });

  it("retrying ship does not duplicate invoice or shipment", async () => {
    const h = await harness();
    await seedStock(h, SKU, 5);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 2, unitPriceCents: 300, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-retry",
    });

    const first = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-retry",
    });
    expect(first.ok).toBe(true);

    const second = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-retry-again",
    });
    expect(second.ok).toBe(true);

    const invoices = await h.uow.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id);
    expect(invoices).not.toBeNull();
    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(3);
  });

  it("rejects cancel after ship", async () => {
    const h = await harness();
    await seedStock(h, SKU, 4);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 2, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-no-cancel",
    });
    await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-no-cancel",
    });

    const cancelled = await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "cancel-after-ship",
    });
    expect(cancelled.ok).toBe(false);
    if (cancelled.ok) {
      return;
    }
    expect(cancelled.reason).toBe("illegal_transition");
  });

  it("rolls back ship when invoice creation fails", async () => {
    const base = new InMemorySalesUnitOfWork();
    const failingAccounting: ISalesUnitOfWork["accounting"] = {
      createInvoiceForOrder: async () => ({ ok: false, reason: "invalid" }),
    };
    const failingUow: ISalesUnitOfWork = {
      salesOrders: base.salesOrders,
      inventory: base.inventory,
      accounting: failingAccounting,
      run: (work) => base.run(() => work(failingUow)),
    };

    const customers = {
      findById: async (organizationId: OrganizationId, id: CustomerId) => {
        if (organizationId === DEFAULT_ORG && id === CUSTOMER_ID) {
          return { id };
        }
        return null;
      },
    };
    const create = new CreateSalesOrderUseCase(failingUow.salesOrders, customers);
    const confirm = new ConfirmSalesOrderUseCase(failingUow);
    const ship = new ShipSalesOrderUseCase(failingUow);
    const snapshot = new GetStockSnapshotUseCase(base.inventoryReadModel);
    const adjustmentIncrease = new RecordAdjustmentIncreaseUseCase(base.ledger);

    await base.run(async () => {
      await adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "rollback-seed",
        sku: SKU,
        quantity: 6,
        refType: "adjustment",
        refId: "rollback-seed",
      });
    });

    const created = await create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 3, unitPriceCents: 100, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "rollback-confirm",
    });

    const result = await ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "rollback-ship",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("accounting_invalid");

    const reloaded = await failingUow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(reloaded?.status).toBe("confirmed");
    const snap = await snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.allocated).toBe(3);
    expect(snap.onHand).toBe(6);
    expect(await base.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id)).toBeNull();
  });

  it("scopes sales orders by organizationId and rejects cross-org customers at create", async () => {
    const h = await harness();
    const acmeOrderId = OrderId.parse(newUuid());
    const betaOrderId = OrderId.parse(newUuid());
    const lineId = SalesOrderLineId.parse(newUuid());
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const unitPrice = Money.fromMinorUnits(500, "USD");

    await h.uow.salesOrders.save({
      id: acmeOrderId,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      documentNumber: "SO-1001",
      status: "draft",
      createdAt,
      lines: [{ id: lineId, sku: SKU, name: "Acme widget", qty: 2, unitPrice }],
    });
    await h.uow.salesOrders.save({
      id: betaOrderId,
      organizationId: BETA_ORG,
      customerId: BETA_CUSTOMER_ID,
      documentNumber: "SO-1001",
      status: "draft",
      createdAt,
      lines: [
        {
          id: SalesOrderLineId.parse(newUuid()),
          sku: SKU,
          name: "Beta widget",
          qty: 3,
          unitPrice,
        },
      ],
    });

    const acmeList = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
    });
    expect(acmeList.total).toBe(1);
    expect(acmeList.items[0]?.documentNumber).toBe("SO-1001");
    expect(acmeList.items[0]?.id).toBe(acmeOrderId);

    const betaList = await h.list.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
    });
    expect(betaList.total).toBe(1);
    expect(betaList.items[0]?.id).toBe(betaOrderId);

    const crossOrgCreate = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: BETA_CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 1, unitPriceCents: 500, currency: "USD" }],
    });
    expect(crossOrgCreate.ok).toBe(false);
    if (crossOrgCreate.ok) {
      return;
    }
    expect(crossOrgCreate.reason).toBe("customer_not_found");

    const crossOrgConfirm = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: betaOrderId,
      idempotencyKey: "confirm-beta-from-acme",
    });
    expect(crossOrgConfirm.ok).toBe(false);
    if (crossOrgConfirm.ok) {
      return;
    }
    expect(crossOrgConfirm.reason).toBe("not_found");
  });
});
