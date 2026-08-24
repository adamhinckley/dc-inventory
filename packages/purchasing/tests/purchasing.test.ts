import {
  GetStockSnapshotUseCase,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { LocationId, Sku, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import {
  CancelPurchaseOrderUseCase,
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  ReceivePurchaseOrderUseCase,
} from "../src/index.js";

const SKU = Sku.parse("PO-TEST-SKU");
const DEFAULT = LocationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

async function harness() {
  const uow = new InMemoryPurchasingUnitOfWork();
  const supplierId = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await uow.suppliers.save({
    id: supplierId,
    vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
    name: PHASE2_SUPPLIER_NAME,
  });

  return {
    uow,
    supplierId,
    create: new CreatePurchaseOrderUseCase(uow.purchaseOrders, uow.suppliers),
    confirm: new ConfirmPurchaseOrderUseCase(uow),
    receive: new ReceivePurchaseOrderUseCase(uow),
    cancel: new CancelPurchaseOrderUseCase(uow),
    snapshot: new GetStockSnapshotUseCase(uow.inventoryReadModel),
  };
}

describe("Purchasing (in-memory)", () => {
  it("assigns PO-00001 document numbers with gaps allowed after cancel", async () => {
    const h = await harness();
    const first = await h.create.execute({
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 5 }],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.purchaseOrder.documentNumber).toBe("PO-00001");

    await h.cancel.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: first.purchaseOrder.id,
      idempotencyKey: "cancel-draft",
    });

    const second = await h.create.execute({
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 3 }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.purchaseOrder.documentNumber).toBe("PO-00002");
  });

  it("confirms, partially receives, and completes with inventory movements", async () => {
    const h = await harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 10 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-1",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.purchaseOrder.status).toBe("confirmed");

    let snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.onOrder).toBe(10);

    const lineId = created.purchaseOrder.lines[0]!.id;
    const partial = await h.receive.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-partial",
      lines: [{ lineId, quantity: 4 }],
    });
    expect(partial.ok).toBe(true);
    if (!partial.ok) {
      return;
    }
    expect(partial.purchaseOrder.status).toBe("confirmed");
    expect(partial.purchaseOrder.lines[0]?.receivedQty).toBe(4);

    snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(4);
    expect(snap.onOrder).toBe(6);

    const complete = await h.receive.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-rest",
      lines: [{ lineId, quantity: 6 }],
    });
    expect(complete.ok).toBe(true);
    if (!complete.ok) {
      return;
    }
    expect(complete.purchaseOrder.status).toBe("received");
    snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(10);
    expect(snap.onOrder).toBe(0);
  });

  it("rejects over-receive and rolls back inventory on failed confirm", async () => {
    const h = await harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 2 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-over",
    });

    const lineId = created.purchaseOrder.lines[0]!.id;
    const over = await h.receive.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-over",
      lines: [{ lineId, quantity: 3 }],
    });
    expect(over.ok).toBe(false);
    if (over.ok) {
      return;
    }
    expect(over.reason).toBe("over_receive");

    const snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(0);
    expect(snap.onOrder).toBe(2);
  });

  it("rejects duplicate SKU lines at create", async () => {
    const h = await harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [
        { sku: SKU.value, name: "Bolt A", qty: 2 },
        { sku: SKU.value, name: "Bolt B", qty: 3 },
      ],
    });
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.reason).toBe("invalid");
  });

  it("cancels confirmed remainder with InboundCancelled", async () => {
    const h = await harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 8 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-cancel",
    });

    const lineId = created.purchaseOrder.lines[0]!.id;
    await h.receive.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-some",
      lines: [{ lineId, quantity: 3 }],
    });

    const cancelled = await h.cancel.execute({
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-remainder",
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }
    expect(cancelled.purchaseOrder.status).toBe("cancelled");

    const snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(3);
    expect(snap.onOrder).toBe(0);
  });
});
