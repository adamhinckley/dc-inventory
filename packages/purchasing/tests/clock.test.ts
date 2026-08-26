import {
  GetStockSnapshotUseCase,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { LocationId, OrganizationId, Sku, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import {
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  GetPurchaseOrderUseCase,
  ReceivePurchaseOrderUseCase,
} from "../src/index.js";

const SKU = Sku.parse("PO-CLOCK-SKU");
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const FIXED = new Date("2021-06-15T12:00:00.000Z");

async function harness() {
  const clock = new InMemoryClock(FIXED);
  const uow = new InMemoryPurchasingUnitOfWork(clock);
  const supplierId = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await uow.suppliers.save({
    id: supplierId,
    organizationId: DEFAULT_ORG,
    vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
    name: PHASE2_SUPPLIER_NAME,
  });

  return {
    clock,
    uow,
    supplierId,
    create: new CreatePurchaseOrderUseCase(uow.purchaseOrders, uow.suppliers, clock),
    get: new GetPurchaseOrderUseCase(uow.purchaseOrders),
    confirm: new ConfirmPurchaseOrderUseCase(uow),
    receive: new ReceivePurchaseOrderUseCase(uow),
    snapshot: new GetStockSnapshotUseCase(uow.inventoryReadModel),
  };
}

describe("Purchasing seed clock (in-memory)", () => {
  it("creates, confirms, and receives through existing inventory transactions", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 10 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.purchaseOrder.documentNumber).toBe("PO-00001");

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "clock-confirm",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.purchaseOrder.status).toBe("confirmed");
    expect((await h.snapshot.execute({ sku: SKU, locationId: DEFAULT })).onOrder).toBe(10);

    const received = await h.receive.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "clock-receive",
      lines: [{ lineId: created.purchaseOrder.lines[0]!.id, quantity: 10 }],
    });
    expect(received.ok).toBe(true);
    if (!received.ok) {
      return;
    }
    expect(received.purchaseOrder.status).toBe("received");
    const snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(10);
    expect(snap.onOrder).toBe(0);
  });

  it("persists the injected creation instant on a purchase order", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 4 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const loaded = await h.get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.purchaseOrder.createdAt.getTime()).toBe(FIXED.getTime());
  });
});
