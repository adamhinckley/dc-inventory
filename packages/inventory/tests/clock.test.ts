import { LocationId, OrganizationId, PurchaseOrderId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryInventoryUnitOfWork } from "../src/adapters/in-memory-inventory-unit-of-work.js";
import {
  GetStockSnapshotUseCase,
  RecordGoodsReceivedUseCase,
  RecordInboundFromPoUseCase,
} from "../src/index.js";

const SKU = Sku.parse("INV-CLOCK-SKU");
const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440030");
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const FIXED = new Date("2021-06-15T12:00:00.000Z");

function harness() {
  const clock = new InMemoryClock(FIXED);
  const uow = new InMemoryInventoryUnitOfWork(clock);
  return {
    clock,
    uow,
    getSnapshot: new GetStockSnapshotUseCase(uow.readModel),
    inboundFromPo: new RecordInboundFromPoUseCase(uow.ledger),
    goodsReceived: new RecordGoodsReceivedUseCase(uow.ledger),
  };
}

describe("Inventory seed clock (in-memory)", () => {
  it("records inbound and receipt through existing ledger rules", async () => {
    const h = harness();
    const inbound = await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "clock-inbound",
      sku: SKU,
      quantity: 6,
      refType: "purchase_order",
      refId: PO_ID,
    });
    expect(inbound.ok).toBe(true);

    const received = await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "clock-receive",
      sku: SKU,
      quantity: 6,
      refType: "purchase_order",
      refId: PO_ID,
    });
    expect(received.ok).toBe(true);

    const snap = await h.getSnapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap).toMatchObject({ onHand: 6, onOrder: 0, allocated: 0, available: 6 });
  });

  it("persists the injected creation instant on stock movements", async () => {
    const h = harness();
    const inbound = await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "clock-inbound-time",
      sku: SKU,
      quantity: 2,
      refType: "purchase_order",
      refId: PO_ID,
    });
    expect(inbound.ok).toBe(true);
    if (!inbound.ok) {
      return;
    }
    expect(inbound.movement.createdAt.getTime()).toBe(FIXED.getTime());

    const listed = await h.uow.readModel.listMovements({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.createdAt.getTime()).toBe(FIXED.getTime());
  });
});
