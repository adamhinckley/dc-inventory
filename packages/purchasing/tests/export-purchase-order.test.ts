import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryFactorySendCatalogPort } from "../src/adapters/in-memory-factory-send-catalog.js";
import { InMemoryCatalogSkuLookupPort } from "../src/adapters/in-memory-catalog-sku-lookup.js";
import { InMemoryWorkbookWriter } from "../src/adapters/in-memory-workbook-writer.js";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import { InMemorySupplierProductRepository } from "../src/adapters/in-memory-supplier-product-repository.js";
import { ExportPurchaseOrderUseCase } from "../src/application/export-purchase-order.js";
import { GetPurchaseOrderFactorySendUseCase } from "../src/application/get-purchase-order-factory-send.js";
import { CreatePurchaseOrderUseCase } from "../src/application/create-purchase-order.js";
import { ConfirmPurchaseOrderUseCase } from "../src/application/confirm-purchase-order.js";
import { ReceivePurchaseOrderUseCase } from "../src/application/receive-purchase-order.js";
import { ReplacePurchaseOrderLinesUseCase } from "../src/application/replace-purchase-order-lines.js";
import { SupplierProductId } from "../src/domain/ids.js";
import { PHASE2_SUPPLIER_NAME, PHASE2_SUPPLIER_VENDOR_NUMBER } from "@dc-inventory/inventory";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SKU = Sku.parse("PO-EXPORT-SKU");
const CATALOG_BOLT = "Bolt from catalog";
const CATALOG_WASHER = "Washer from catalog";
const CATALOG_MORNING_GLORY = "Morning Glory from catalog";

function factoryLine(overrides: {
  mat_num: string;
  quan: number;
  description: string;
  price?: number | "";
  extprice?: number | "";
  mfg_code?: string;
  ship_date?: Date | "";
  canc_date?: Date | "";
  tot_cartons?: number | "";
}) {
  return {
    ship_date: overrides.ship_date ?? "",
    canc_date: overrides.canc_date ?? "",
    mat_num: overrides.mat_num,
    quan: overrides.quan,
    price: overrides.price ?? "",
    extprice: overrides.extprice ?? "",
    description: overrides.description,
    mfg_code: overrides.mfg_code ?? "",
    mfg_sku: "",
    mfg_upc: "",
    product_upc_1: "",
    cs_cube_metric: 0,
    tot_cartons: overrides.tot_cartons ?? "",
    tot_cbm: "Not Available",
  };
}

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
  const supplierProducts = new InMemorySupplierProductRepository();
  const factorySendCatalog = new InMemoryFactorySendCatalogPort();
  const catalog = new InMemoryCatalogSkuLookupPort();
  catalog.set(DEFAULT_ORG, SKU.value, CATALOG_BOLT);
  catalog.set(DEFAULT_ORG, "WASHER-SS", CATALOG_WASHER);
  catalog.set(DEFAULT_ORG, "DCB6008BL", CATALOG_MORNING_GLORY);
  return {
    uow,
    supplierId,
    workbookWriter,
    supplierProducts,
    factorySendCatalog,
    catalog,
    create: new CreatePurchaseOrderUseCase(uow.purchaseOrders, uow.suppliers, catalog),
    confirm: new ConfirmPurchaseOrderUseCase(uow, catalog),
    receive: new ReceivePurchaseOrderUseCase(uow),
    replace: new ReplacePurchaseOrderLinesUseCase(uow.purchaseOrders, catalog),
    exportPo: new ExportPurchaseOrderUseCase(
      uow.purchaseOrders,
      supplierProducts,
      factorySendCatalog,
      workbookWriter,
    ),
    factorySend: new GetPurchaseOrderFactorySendUseCase(
      uow.purchaseOrders,
      supplierProducts,
      factorySendCatalog,
    ),
  };
}

describe("ExportPurchaseOrderUseCase", () => {
  it("exports draft purchase order lines in the factory send layout", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [
        { sku: SKU.value, name: "Caller bolt label", qty: 5 },
        { sku: "WASHER-SS", name: "Caller washer label", qty: 2 },
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
      factoryLine({ mat_num: SKU.value, quan: 5, description: CATALOG_BOLT }),
      factoryLine({ mat_num: "WASHER-SS", quan: 2, description: CATALOG_WASHER }),
    ]);
  });

  it("exports confirmed purchase order lines", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Caller bolt label", qty: 10 }],
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
      factoryLine({ mat_num: SKU.value, quan: 10, description: CATALOG_BOLT }),
    ]);
  });

  it("keeps ordered quantity after receive, not warehouse received qty", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [{ sku: SKU.value, name: "Caller bolt label", qty: 10 }],
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
      factoryLine({ mat_num: SKU.value, quan: 10, description: CATALOG_BOLT }),
    ]);
  });

  it("fills mill code and decimal-dollar cost from the supplier product", async () => {
    const h = await harness();
    h.catalog.set(DEFAULT_ORG, SKU.value, "Red Enamel Star");
    await h.supplierProducts.save({
      id: SupplierProductId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      supplierId: h.supplierId,
      sku: SKU,
      supplierSku: "QSLH-V15",
      minOrderQty: null,
      minOrderAmountCents: null,
      lastPoCostCents: 65,
      currency: "USD",
    });
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [
        { sku: SKU.value, name: "Caller star label", qty: 1152 },
        { sku: "WASHER-SS", name: "Caller washer label", qty: 2 },
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
    expect(h.workbookWriter.writes[0]?.rows).toEqual([
      factoryLine({
        mat_num: SKU.value,
        quan: 1152,
        description: "Red Enamel Star",
        price: 0.65,
        extprice: 748.8,
        mfg_code: "QSLH-V15",
      }),
      factoryLine({ mat_num: "WASHER-SS", quan: 2, description: CATALOG_WASHER }),
    ]);
  });

  it("repeats computed carton total from case qty on every line", async () => {
    const h = await harness();
    h.catalog.set(DEFAULT_ORG, SKU.value, "Rose from catalog");
    h.factorySendCatalog.set(DEFAULT_ORG, SKU.value, { caseQty: 192 });
    h.factorySendCatalog.set(DEFAULT_ORG, "DCB6008BL", { caseQty: 384 });
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      lines: [
        { sku: SKU.value, name: "Caller rose label", qty: 1152 },
        { sku: "DCB6008BL", name: "Caller glory label", qty: 7680 },
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
    expect(h.workbookWriter.writes[0]?.rows).toEqual([
      factoryLine({
        mat_num: SKU.value,
        quan: 1152,
        description: "Rose from catalog",
        tot_cartons: 26,
      }),
      factoryLine({
        mat_num: "DCB6008BL",
        quan: 7680,
        description: CATALOG_MORNING_GLORY,
        tot_cartons: 26,
      }),
    ]);
  });

  it("writes ship and cancel dates from the purchase order header", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      shipDate: "2026-12-01",
      cancelDate: "2026-01-15",
      lines: [{ sku: SKU.value, name: "Caller bolt label", qty: 10 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const replaced = await h.replace.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
      shipDate: "2026-12-01",
      cancelDate: "2026-01-15",
      lines: [{ sku: SKU.value, name: "Caller bolt label", qty: 10 }],
    });
    expect(replaced.ok).toBe(true);

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
      factoryLine({
        mat_num: SKU.value,
        quan: 10,
        description: CATALOG_BOLT,
        ship_date: new Date("2026-12-01T00:00:00.000Z"),
        canc_date: new Date("2026-01-15T00:00:00.000Z"),
      }),
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

describe("GetPurchaseOrderFactorySendUseCase", () => {
  it("returns the factory send columns and JSON rows used by XLS export", async () => {
    const h = await harness();
    h.catalog.set(DEFAULT_ORG, SKU.value, "Bolt from Catalog");
    h.factorySendCatalog.set(DEFAULT_ORG, SKU.value, { caseQty: 192 });
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: h.supplierId,
      shipDate: "2026-12-01",
      cancelDate: "2026-01-15",
      lines: [{ sku: SKU.value, name: "Caller-controlled bolt label", qty: 1152 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await h.factorySend.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: created.purchaseOrder.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows[0]).toMatchObject({
      ship_date: "2026-12-01",
      canc_date: "2026-01-15",
      mat_num: SKU.value,
      quan: 1152,
      description: "Bolt from Catalog",
      tot_cartons: 6,
      tot_cbm: "Not Available",
    });
  });
});
