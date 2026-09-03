import {
  GetStockSnapshotUseCase,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import {
  LocationId,
  OrganizationId,
  PurchaseOrderId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import { newUuid, PurchaseOrderLineId } from "../src/domain/ids.js";
import type { IPurchasingUnitOfWork } from "../src/domain/ports/purchase-order-repository.js";
import {
  CancelPurchaseOrderUseCase,
  CancelRemainingPurchaseOrderUseCase,
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  InMemoryCatalogSkuLookupPort,
  ListPurchaseOrdersUseCase,
  ReceivePurchaseOrderUseCase,
  ReplacePurchaseOrderLinesUseCase,
} from "../src/index.js";

const SKU = Sku.parse("PO-TEST-SKU");
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

async function harness() {
  const uow = new InMemoryPurchasingUnitOfWork();
  const catalog = new InMemoryCatalogSkuLookupPort();
  catalog.set(DEFAULT_ORG, SKU.value, "Catalog bolt");
  catalog.set(DEFAULT_ORG, "PO-OTHER-SKU", "Catalog washer");
  const supplierId = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await uow.suppliers.save({
    id: supplierId,
    organizationId: DEFAULT_ORG,
    vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
    name: PHASE2_SUPPLIER_NAME,
  });

  return {
    uow,
    catalog,
    supplierId,
    create: new CreatePurchaseOrderUseCase(uow.purchaseOrders, uow.suppliers, catalog),
    list: new ListPurchaseOrdersUseCase(uow.purchaseOrders, uow.suppliers),
    confirm: new ConfirmPurchaseOrderUseCase(uow, catalog),
    receive: new ReceivePurchaseOrderUseCase(uow),
    cancel: new CancelPurchaseOrderUseCase(uow),
    cancelRemaining: new CancelRemainingPurchaseOrderUseCase(uow),
    replaceLines: new ReplacePurchaseOrderLinesUseCase(uow.purchaseOrders, catalog),
    snapshot: new GetStockSnapshotUseCase(uow.inventoryReadModel),
  };
}

describe("Purchasing (in-memory)", () => {
  it("assigns PO-00001 document numbers with gaps allowed after cancel", async () => {
    const h = await harness();
    const first = await h.create.execute({
      organizationId: DEFAULT_ORG,
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
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: first.purchaseOrder.id,
      idempotencyKey: "cancel-draft",
    });

    const second = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 3 }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.purchaseOrder.documentNumber).toBe("PO-00002");

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
      supplierId: h.supplierId,
    });
    expect(searched.items.map((order) => order.documentNumber)).toEqual(["PO-00002"]);
  });

  it("sorts listed purchase orders by ship date and remaining qty", async () => {
    const h = await harness();
    const later = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      shipDate: "2026-06-01",
      lines: [{ sku: SKU.value, name: "Bolt", qty: 2 }],
    });
    const sooner = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      shipDate: "2026-03-01",
      lines: [{ sku: SKU.value, name: "Bolt", qty: 9 }],
    });
    expect(later.ok && sooner.ok).toBe(true);
    if (!later.ok || !sooner.ok) {
      return;
    }

    const byShip = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "shipDate",
      sortOrder: "asc",
    });
    expect(byShip.items.map((order) => order.documentNumber)).toEqual([
      sooner.purchaseOrder.documentNumber,
      later.purchaseOrder.documentNumber,
    ]);

    const byRemaining = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "remaining",
      sortOrder: "desc",
    });
    expect(byRemaining.items.map((order) => order.documentNumber)).toEqual([
      sooner.purchaseOrder.documentNumber,
      later.purchaseOrder.documentNumber,
    ]);
  });

  it("confirms, partially receives, and completes with inventory movements", async () => {
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

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-1",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.purchaseOrder.status).toBe("confirmed");

    let snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onOrder).toBe(10);

    const lineId = created.purchaseOrder.lines[0]!.id;
    const partial = await h.receive.execute({
      organizationId: DEFAULT_ORG,
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

    snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(4);
    expect(snap.onOrder).toBe(6);

    const complete = await h.receive.execute({
      organizationId: DEFAULT_ORG,
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
    snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(10);
    expect(snap.onOrder).toBe(0);
  });

  it("rejects over-receive and rolls back inventory on failed confirm", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 2 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-over",
    });

    const lineId = created.purchaseOrder.lines[0]!.id;
    const over = await h.receive.execute({
      organizationId: DEFAULT_ORG,
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

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(0);
    expect(snap.onOrder).toBe(2);
  });

  it("replaces lines on a draft purchase order and rejects non-draft", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 5 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const replaced = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      lines: [
        { sku: SKU.value, name: "Bolt updated", qty: 8 },
        { sku: "PO-OTHER-SKU", name: "Washer", qty: 2 },
      ],
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.purchaseOrder.status).toBe("draft");
    expect(replaced.purchaseOrder.documentNumber).toBe(created.purchaseOrder.documentNumber);
    expect(replaced.purchaseOrder.supplierId).toBe(created.purchaseOrder.supplierId);
    expect(replaced.purchaseOrder.lines).toHaveLength(2);
    expect(replaced.purchaseOrder.lines[0]).toMatchObject({
      sku: SKU,
      name: "Catalog bolt",
      qty: 8,
      receivedQty: 0,
    });
    expect(replaced.purchaseOrder.lines[1]).toMatchObject({
      name: "Catalog washer",
      qty: 2,
      receivedQty: 0,
    });
    expect(replaced.purchaseOrder.lines[0]?.id).not.toBe(created.purchaseOrder.lines[0]?.id);

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-after-replace",
    });

    const blocked = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      lines: [{ sku: SKU.value, name: "Too late", qty: 1 }],
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    expect(blocked.reason).toBe("illegal_transition");
  });

  it("rejects empty and duplicate SKU lines on draft replace", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 5 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const empty = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      lines: [],
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) {
      return;
    }
    expect(empty.reason).toBe("empty_order");

    const duplicate = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      lines: [
        { sku: SKU.value, name: "Bolt A", qty: 2 },
        { sku: SKU.value, name: "Bolt B", qty: 3 },
      ],
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) {
      return;
    }
    expect(duplicate.reason).toBe("invalid");
  });

  it("rejects duplicate SKU lines at create", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
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

  it("freezes the Catalog SKU and name instead of caller-supplied line data", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Caller controlled name", qty: 2 }],
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.purchaseOrder.lines[0]).toMatchObject({
        sku: SKU,
        name: "Catalog bolt",
      });
    }
  });

  it("rejects unknown, archived, and organization-mismatched products before saving", async () => {
    const cases = [
      {
        name: "unknown",
        setup: (_catalog: InMemoryCatalogSkuLookupPort) => undefined,
        sku: "UNKNOWN-SKU",
        reason: "product_not_found",
      },
      {
        name: "archived",
        setup: (catalog: InMemoryCatalogSkuLookupPort) =>
          catalog.set(DEFAULT_ORG, "ARCHIVED-SKU", "Archived product", { archived: true }),
        sku: "ARCHIVED-SKU",
        reason: "product_archived",
      },
      {
        name: "organization-mismatched",
        setup: (catalog: InMemoryCatalogSkuLookupPort) =>
          catalog.set(BETA_ORG, "OTHER-ORG-SKU", "Other organization product"),
        sku: "OTHER-ORG-SKU",
        reason: "product_not_found",
      },
    ] as const;

    for (const testCase of cases) {
      const h = await harness();
      testCase.setup(h.catalog);
      const result = await h.create.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        supplierId: h.supplierId,
        lines: [{ sku: testCase.sku, name: "Caller name", qty: 1 }],
      });

      expect(result, testCase.name).toEqual({ ok: false, reason: testCase.reason });
      const saved = await h.uow.purchaseOrders.list({
        organizationId: DEFAULT_ORG,
        page: 1,
        pageSize: 25,
      });
      expect(saved.total, testCase.name).toBe(0);
    }
  });

  it("rejects an orphaned persisted draft before recording inbound inventory", async () => {
    const h = await harness();
    const orphanSku = Sku.parse("ORPHAN-SKU");
    const purchaseOrderId = PurchaseOrderId.parse(newUuid());
    await h.uow.purchaseOrders.save({
      id: purchaseOrderId,
      organizationId: DEFAULT_ORG,
      supplierId: h.supplierId,
      documentNumber: "PO-00001",
      status: "draft",
      shipDate: null,
      cancelDate: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      lines: [
        {
          id: PurchaseOrderLineId.parse(newUuid()),
          sku: orphanSku,
          name: "Legacy unchecked product",
          qty: 4,
          receivedQty: 0,
        },
      ],
    });

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId,
      idempotencyKey: "confirm-orphan",
    });

    expect(confirmed).toEqual({ ok: false, reason: "product_not_found" });
    const snapshot = await h.snapshot.execute({
      organizationId: DEFAULT_ORG,
      sku: orphanSku,
      locationId: DEFAULT,
    });
    expect(snapshot.onOrder).toBe(0);
    expect((await h.uow.purchaseOrders.findById(DEFAULT_ORG, purchaseOrderId))?.status).toBe("draft");
  });

  it("closes partial receive as received with InboundCancelled for leftover qty", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 100 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-cancel-remaining",
    });

    const lineId = created.purchaseOrder.lines[0]!.id;
    await h.receive.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-partial-cancel-remaining",
      lines: [{ lineId, quantity: 90 }],
    });

    const closed = await h.cancelRemaining.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-remaining",
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok) {
      return;
    }
    expect(closed.purchaseOrder.status).toBe("received");
    expect(closed.purchaseOrder.lines[0]?.receivedQty).toBe(90);

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(90);
    expect(snap.onOrder).toBe(0);

    const movements = await h.uow.inventoryReadModel.listMovements({
      organizationId: DEFAULT_ORG,
      sku: SKU,
      locationId: DEFAULT,
    });
    const inboundCancelled = movements.filter((movement) => movement.movementType === "InboundCancelled");
    expect(inboundCancelled).toHaveLength(1);
    expect(inboundCancelled[0]?.quantity).toBe(10);
  });

  it("replays cancel remaining idempotently without a second movement", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 100 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-idempotent-cancel-remaining",
    });

    const lineId = created.purchaseOrder.lines[0]!.id;
    await h.receive.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-idempotent-cancel-remaining",
      lines: [{ lineId, quantity: 90 }],
    });

    const first = await h.cancelRemaining.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "same-cancel-remaining-key",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = await h.cancelRemaining.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "same-cancel-remaining-key",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.purchaseOrder.status).toBe("received");

    const movements = await h.uow.inventoryReadModel.listMovements({
      organizationId: DEFAULT_ORG,
      sku: SKU,
      locationId: DEFAULT,
    });
    expect(movements.filter((movement) => movement.movementType === "InboundCancelled")).toHaveLength(1);
  });

  it("rejects cancel remaining on zero-receive confirmed PO while cancel still works", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 100 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-zero-receive",
    });

    const blocked = await h.cancelRemaining.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-remaining-zero-receive",
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    expect(blocked.reason).toBe("illegal_transition");

    const cancelled = await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-zero-receive",
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }
    expect(cancelled.purchaseOrder.status).toBe("cancelled");
  });

  it("rejects cancel remaining on draft and already received purchase orders", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 5 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const draftBlocked = await h.cancelRemaining.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-remaining-draft",
    });
    expect(draftBlocked).toEqual({ ok: false, reason: "illegal_transition" });

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-received-block",
    });

    const lineId = created.purchaseOrder.lines[0]!.id;
    await h.receive.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-full",
      lines: [{ lineId, quantity: 5 }],
    });

    const receivedBlocked = await h.cancelRemaining.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-remaining-received",
    });
    expect(receivedBlocked).toEqual({ ok: false, reason: "illegal_transition" });
  });

  it("rolls back purchase order status when cancel remaining inventory write fails", async () => {
    const base = new InMemoryPurchasingUnitOfWork();
    const catalog = new InMemoryCatalogSkuLookupPort();
    catalog.set(DEFAULT_ORG, SKU.value, "Catalog bolt");
    catalog.set(DEFAULT_ORG, "PO-OTHER-SKU", "Catalog washer");
    const supplierId = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await base.suppliers.save({
      id: supplierId,
      organizationId: DEFAULT_ORG,
      vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
      name: PHASE2_SUPPLIER_NAME,
    });

    let cancelCalls = 0;
    const failingInventory: IPurchasingUnitOfWork["inventory"] = {
      lockSnapshots: (snapshots) => base.inventory.lockSnapshots(snapshots),
      recordInboundFromPo: (command) => base.inventory.recordInboundFromPo(command),
      recordGoodsReceived: (command) => base.inventory.recordGoodsReceived(command),
      recordInboundCancelled: async (command) => {
        cancelCalls += 1;
        if (cancelCalls === 2) {
          return { ok: false, reason: "provenance_conflict" };
        }
        return base.inventory.recordInboundCancelled(command);
      },
      recordCommitted: (command) => base.inventory.recordCommitted(command),
      matchesCommittedIdempotency: (command) =>
        base.inventory.matchesCommittedIdempotency(command),
      recordDecommitted: (command) => base.inventory.recordDecommitted(command),
      matchesDecommittedIdempotency: (command) =>
        base.inventory.matchesDecommittedIdempotency(command),
      recordAllocated: (command) => base.inventory.recordAllocated(command),
      recordDeallocated: (command) => base.inventory.recordDeallocated(command),
      recordShipped: (command) => base.inventory.recordShipped(command),
      getOrderCoverQuantity: (query) => base.inventory.getOrderCoverQuantity(query),
    };
    const failingUow: IPurchasingUnitOfWork = {
      purchaseOrders: base.purchaseOrders,
      suppliers: base.suppliers,
      inventory: failingInventory,
      run: (work) => base.run(() => work(failingUow)),
    };

    const create = new CreatePurchaseOrderUseCase(base.purchaseOrders, base.suppliers, catalog);
    const confirm = new ConfirmPurchaseOrderUseCase(failingUow, catalog);
    const receive = new ReceivePurchaseOrderUseCase(failingUow);
    const cancelRemaining = new CancelRemainingPurchaseOrderUseCase(failingUow);

    const created = await create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId,
      lines: [
        { sku: SKU.value, name: "Bolt", qty: 10 },
        { sku: "PO-OTHER-SKU", name: "Washer", qty: 10 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-rollback",
    });

    const lineIds = created.purchaseOrder.lines.map((line) => line.id);
    await receive.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-rollback",
      lines: lineIds.map((lineId) => ({ lineId, quantity: 5 })),
    });

    const failed = await cancelRemaining.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-remaining-rollback",
    });
    expect(failed).toEqual({ ok: false, reason: "inventory_conflict" });

    const saved = await base.purchaseOrders.findById(DEFAULT_ORG, created.purchaseOrder.id);
    expect(saved?.status).toBe("confirmed");
  });

  it("cancels confirmed remainder with InboundCancelled", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Bolt", qty: 8 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "confirm-cancel",
    });

    const lineId = created.purchaseOrder.lines[0]!.id;
    await h.receive.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "receive-some",
      lines: [{ lineId, quantity: 3 }],
    });

    const cancelled = await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "cancel-remainder",
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }
    expect(cancelled.purchaseOrder.status).toBe("cancelled");

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(3);
    expect(snap.onOrder).toBe(0);
  });

  it("scopes purchase orders by organizationId and allows duplicate vendor numbers and PO numbers across orgs", async () => {
    const h = await harness();
    const acmeSupplierId = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const betaSupplierId = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    await h.uow.suppliers.save({
      id: betaSupplierId,
      organizationId: BETA_ORG,
      vendorNumber: "V-1",
      name: "Beta vendor",
    });
    await h.uow.suppliers.save({
      id: acmeSupplierId,
      organizationId: DEFAULT_ORG,
      vendorNumber: "V-1",
      name: "Acme vendor",
    });

    const acmePoId = PurchaseOrderId.parse(newUuid());
    const betaPoId = PurchaseOrderId.parse(newUuid());
    const lineId = PurchaseOrderLineId.parse(newUuid());
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    await h.uow.purchaseOrders.save({
      id: acmePoId,
      organizationId: DEFAULT_ORG,
      supplierId: acmeSupplierId,
      documentNumber: "PO-1001",
      status: "draft",
      shipDate: null,
      cancelDate: null,
      createdAt,
      lines: [{ id: lineId, sku: SKU, name: "Acme bolt", qty: 5, receivedQty: 0 }],
    });
    await h.uow.purchaseOrders.save({
      id: betaPoId,
      organizationId: BETA_ORG,
      supplierId: betaSupplierId,
      documentNumber: "PO-1001",
      status: "draft",
      shipDate: null,
      cancelDate: null,
      createdAt,
      lines: [
        {
          id: PurchaseOrderLineId.parse(newUuid()),
          sku: SKU,
          name: "Beta bolt",
          qty: 3,
          receivedQty: 0,
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
    expect(acmeList.items[0]?.documentNumber).toBe("PO-1001");
    expect(acmeList.items[0]?.id).toBe(acmePoId);
    expect(acmeList.supplierNames.get(acmeSupplierId)).toBe("Acme vendor");

    const betaList = await h.list.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
    });
    expect(betaList.total).toBe(1);
    expect(betaList.items[0]?.id).toBe(betaPoId);
  });
});
