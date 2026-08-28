import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryWorkbookWriter } from "../src/adapters/in-memory-workbook-writer.js";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import { ExportPurchaseOrderUseCase } from "../src/application/export-purchase-order.js";
import { CreatePurchaseOrderUseCase } from "../src/application/create-purchase-order.js";
import { ConfirmPurchaseOrderUseCase } from "../src/application/confirm-purchase-order.js";
import { ReceivePurchaseOrderUseCase } from "../src/application/receive-purchase-order.js";
import { PHASE2_SUPPLIER_NAME, PHASE2_SUPPLIER_VENDOR_NUMBER } from "@dc-inventory/inventory";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SKU = Sku.parse("PO-EXPORT-SKU");

async function harness() {
  const uow = new InMemoryPurchasingUnitOfWork();
  const supplierId = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await uow.suppliers.save({
    id: supplierId,
    organizationId: DEFAULT_ORG,
    vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
    name: PHASE2_SUPPLIER_NAME,
  });
  const workbookWriter = new InMemoryWorkbookWriter();
  return {
    uow,
    supplierId,
    workbookWriter,
    create: new CreatePurchaseOrderUseCase(uow.purchaseOrders, uow.suppliers),
    confirm: new ConfirmPurchaseOrderUseCase(uow),
    receive: new ReceivePurchaseOrderUseCase(uow),
    exportPo: new ExportPurchaseOrderUseCase(uow.purchaseOrders, workbookWriter),
  };
}

describe("ExportPurchaseOrderUseCase", () => {
  it("exports draft purchase order lines as xlsx", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [
        { sku: SKU.value, name: "Bolt", qty: 5 },
        { sku: "WASHER-SS", name: "Washer", qty: 2 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await h.exportPo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      format: "xlsx",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.file.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(result.file.filename).toBe("PO-00001.xlsx");
    expect(h.workbookWriter.writes).toHaveLength(1);
    expect(h.workbookWriter.writes[0]?.rows).toEqual([
      { sku: SKU.value, name: "Bolt", qty: 5, receivedQty: 0 },
      { sku: "WASHER-SS", name: "Washer", qty: 2, receivedQty: 0 },
    ]);
  });

  it("exports confirmed purchase order lines", async () => {
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
    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "export-confirm",
    });

    const result = await h.exportPo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      format: "xlsx",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(h.workbookWriter.writes[0]?.rows).toEqual([
      { sku: SKU.value, name: "Bolt", qty: 10, receivedQty: 0 },
    ]);
  });

  it("exports received quantities after partial receive", async () => {
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
    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "export-receive-confirm",
    });
    const lineId = created.purchaseOrder.lines[0]!.id;
    await h.receive.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: "export-receive",
      lines: [{ lineId, quantity: 4 }],
    });

    const result = await h.exportPo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      format: "xlsx",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(h.workbookWriter.writes[0]?.rows).toEqual([
      { sku: SKU.value, name: "Bolt", qty: 10, receivedQty: 4 },
    ]);
  });

  it("returns not_found for missing purchase order", async () => {
    const h = await harness();
    const result = await h.exportPo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: PurchaseOrderId.parse("99999999-9999-4999-8999-999999999999"),
      format: "xlsx",
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(h.workbookWriter.writes).toHaveLength(0);
  });
});
