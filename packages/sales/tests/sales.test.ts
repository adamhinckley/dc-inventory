import {
  GetStockSnapshotUseCase,
  RecordAdjustmentIncreaseUseCase,
} from "@dc-inventory/inventory";
import { CustomerId, LocationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemorySalesUnitOfWork } from "../src/adapters/in-memory-sales-unit-of-work.js";
import {
  CancelSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
} from "../src/index.js";

const SKU = Sku.parse("SO-TEST-SKU");
const SKU_B = Sku.parse("SO-TEST-SKU-B");
const DEFAULT = LocationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

async function harness() {
  const uow = new InMemorySalesUnitOfWork();
  const customers = {
    findById: async (id: CustomerId) => (id === CUSTOMER_ID ? { id } : null),
  };

  return {
    uow,
    customers,
    create: new CreateSalesOrderUseCase(uow.salesOrders, customers),
    confirm: new ConfirmSalesOrderUseCase(uow),
    cancel: new CancelSalesOrderUseCase(uow),
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
      staffUserId: STAFF_ID,
      salesOrderId: first.salesOrder.id,
      idempotencyKey: "cancel-draft",
    });

    const second = await h.create.execute({
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 1, unitPriceCents: 500, currency: "USD" }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.salesOrder.documentNumber).toBe("SO-00002");
  });

  it("merges duplicate SKU lines at create", async () => {
    const h = await harness();
    const created = await h.create.execute({
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
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 0, unitPriceCents: 500, currency: "USD" }],
    });
    expect(zero.ok).toBe(false);
  });

  it("allows draft quantity over available", async () => {
    const h = await harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 100, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    const snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.available).toBe(0);
  });

  it("confirms with all-or-nothing ATP and allocates inventory", async () => {
    const h = await harness();
    await seedStock(h, SKU, 10);

    const created = await h.create.execute({
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
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-short",
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) {
      return;
    }
    expect(failed.reason).toBe("insufficient_atp");

    const reloaded = await h.uow.salesOrders.findById(created.salesOrder.id);
    expect(reloaded?.status).toBe("draft");

    await seedStock(h, SKU_B, 1);
    const confirmed = await h.confirm.execute({
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-ok",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.salesOrder.status).toBe("confirmed");

    const snapA = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snapA.allocated).toBe(4);
    expect(snapA.available).toBe(6);
    const snapB = await h.snapshot.execute({ sku: SKU_B, locationId: DEFAULT });
    expect(snapB.allocated).toBe(3);
    expect(snapB.available).toBe(0);
  });

  it("cancels confirmed orders with deallocation", async () => {
    const h = await harness();
    await seedStock(h, SKU, 8);

    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 5, unitPriceCents: 500, currency: "USD" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-cancel",
    });

    const cancelled = await h.cancel.execute({
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "cancel-confirmed",
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }
    expect(cancelled.salesOrder.status).toBe("cancelled");

    const snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.allocated).toBe(0);
    expect(snap.available).toBe(8);
  });

  it("prevents two confirms that together exceed available", async () => {
    const h = await harness();
    await seedStock(h, SKU, 5);

    const firstOrder = await h.create.execute({
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ sku: SKU.value, name: "Widget", qty: 4, unitPriceCents: 500, currency: "USD" }],
    });
    const secondOrder = await h.create.execute({
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
      staffUserId: STAFF_ID,
      salesOrderId: firstOrder.salesOrder.id,
      idempotencyKey: "confirm-a",
    });
    expect(firstConfirm.ok).toBe(true);

    const secondConfirm = await h.confirm.execute({
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
});
