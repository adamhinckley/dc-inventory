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
import {
  CancelPurchaseOrderUseCase,
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
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
  const supplierId = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await uow.suppliers.save({
    id: supplierId,
    organizationId: DEFAULT_ORG,
    vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
    name: PHASE2_SUPPLIER_NAME,
  });

  return {
    uow,
    supplierId,
    create: new CreatePurchaseOrderUseCase(uow.purchaseOrders, uow.suppliers),
    list: new ListPurchaseOrdersUseCase(uow.purchaseOrders, uow.suppliers),
    confirm: new ConfirmPurchaseOrderUseCase(uow),
    receive: new ReceivePurchaseOrderUseCase(uow),
    cancel: new CancelPurchaseOrderUseCase(uow),
    replaceLines: new ReplacePurchaseOrderLinesUseCase(uow.purchaseOrders),
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

    let snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
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

    snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
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
    snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
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

    const snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
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
      name: "Bolt updated",
      qty: 8,
      receivedQty: 0,
    });
    expect(replaced.purchaseOrder.lines[1]).toMatchObject({
      name: "Washer",
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

    const snap = await h.snapshot.execute({ sku: SKU, locationId: DEFAULT });
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
