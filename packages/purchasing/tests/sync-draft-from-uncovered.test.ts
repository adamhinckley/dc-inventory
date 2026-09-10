import {
  InMemoryUncoveredCaseQtyReadPort,
  type IUncoveredListQuery,
  type UncoveredListCoreRow,
} from "@dc-inventory/inventory";
import {
  OrganizationId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { InMemoryCatalogSkuLookupPort } from "../src/adapters/in-memory-catalog-sku-lookup.js";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import { InMemorySupplierProductRepository } from "../src/adapters/in-memory-supplier-product-repository.js";
import { InMemorySupplierSkuMappingReadPort } from "../src/adapters/in-memory-supplier-sku-mapping.js";
import { AssignSupplierProductUseCase } from "../src/application/assign-supplier-product.js";
import { CreatePurchaseOrderUseCase } from "../src/application/create-purchase-order.js";
import { draftPoQtyFromUncovered } from "../src/application/draft-po-qty-from-uncovered.js";
import { SyncDraftPurchaseOrdersFromUncoveredUseCase } from "../src/application/sync-draft-purchase-orders-from-uncovered.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const SUPPLIER_A = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SUPPLIER_B = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU_A = Sku.parse("SYNC-DRAFT-A");
const SKU_B = Sku.parse("SYNC-DRAFT-B");
const SKU_C = Sku.parse("SYNC-DRAFT-C");

class StubUncoveredListQuery implements IUncoveredListQuery {
  private readonly rows = new Map<string, UncoveredListCoreRow>();

  set(
    organizationId: OrganizationId,
    sku: string,
    row: Omit<UncoveredListCoreRow, "sku">,
  ): void {
    this.rows.set(`${organizationId}:${sku}`, {
      sku: Sku.parse(sku),
      ...row,
    });
  }

  clear(organizationId: OrganizationId): void {
    for (const key of [...this.rows.keys()]) {
      if (key.startsWith(`${organizationId}:`)) {
        this.rows.delete(key);
      }
    }
  }

  async list(query: { page: number; pageSize: number; organizationId: OrganizationId }) {
    const rows = await this.listAll({ organizationId: query.organizationId });
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(offset, offset + query.pageSize),
      total: rows.length,
    };
  }

  async listAll(query: { organizationId: OrganizationId }) {
    const prefix = `${query.organizationId}:`;
    return [...this.rows.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, row]) => row);
  }

  async listFactories() {
    return { items: [], total: 0 };
  }
}

async function harness() {
  const clock = new InMemoryClock(new Date("2026-09-07T12:00:00.000Z"));
  const uow = new InMemoryPurchasingUnitOfWork();
  const catalog = new InMemoryCatalogSkuLookupPort();
  const supplierProducts = new InMemorySupplierProductRepository();
  const uncoveredList = new StubUncoveredListQuery();
  const caseQty = new InMemoryUncoveredCaseQtyReadPort();
  const supplierMapping = new InMemorySupplierSkuMappingReadPort(
    uow.suppliers,
    supplierProducts,
  );
  const assignProduct = new AssignSupplierProductUseCase(
    uow.suppliers,
    supplierProducts,
    catalog,
  );
  const createPurchaseOrder = new CreatePurchaseOrderUseCase(
    uow.purchaseOrders,
    uow.suppliers,
    catalog,
    clock,
  );
  const syncDrafts = new SyncDraftPurchaseOrdersFromUncoveredUseCase(
    uow,
    supplierMapping,
    uncoveredList,
    caseQty,
    catalog,
  );

  catalog.set(DEFAULT_ORG, SKU_A.value, "Widget A");
  catalog.set(DEFAULT_ORG, SKU_B.value, "Widget B");
  catalog.set(DEFAULT_ORG, SKU_C.value, "Widget C");

  await uow.suppliers.save({
    id: SUPPLIER_A,
    organizationId: DEFAULT_ORG,
    vendorNumber: "FA",
    name: "Factory A",
    poPrefix: "HF",
  });
  await uow.suppliers.save({
    id: SUPPLIER_B,
    organizationId: DEFAULT_ORG,
    vendorNumber: "FB",
    name: "Factory B",
    poPrefix: "FB",
  });

  return {
    clock,
    uow,
    catalog,
    supplierProducts,
    supplierMapping,
    uncoveredList,
    caseQty,
    assignProduct,
    createPurchaseOrder,
    syncDrafts,
  };
}

function seedUncovered(
  h: Awaited<ReturnType<typeof harness>>,
  rows: ReadonlyArray<{
    sku: Sku;
    uncovered: number;
    committed: number;
    onHand: number;
    onOrder: number;
  }>,
): void {
  for (const row of rows) {
    h.uncoveredList.set(DEFAULT_ORG, row.sku.value, {
      committed: row.committed,
      onHand: row.onHand,
      onOrder: row.onOrder,
      uncovered: row.uncovered,
    });
  }
}

describe("SyncDraftPurchaseOrdersFromUncoveredUseCase", () => {
  it("replaces draft lines from current uncovered SKUs at suggested qty", async () => {
    const h = await harness();
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_B.value,
    });

    seedUncovered(h, [
      { sku: SKU_A, uncovered: 584, committed: 584, onHand: 0, onOrder: 0 },
      { sku: SKU_B, uncovered: 40, committed: 40, onHand: 0, onOrder: 0 },
    ]);
    h.caseQty.set(DEFAULT_ORG, SKU_A.value, 100);
    h.caseQty.set(DEFAULT_ORG, SKU_B.value, null);

    const created = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      lines: [{ sku: SKU_A.value, qty: 1 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await h.syncDrafts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.purchaseOrderIds).toEqual([created.purchaseOrder.id]);
    expect(result.syncedSupplierIds).toEqual([SUPPLIER_A]);
    expect(result.clearedSupplierIds).toEqual([]);
    expect(result.unmappedSkus).toEqual([]);

    const synced = await h.uow.purchaseOrders.findById(
      DEFAULT_ORG,
      created.purchaseOrder.id,
    );
    expect(synced?.lines).toHaveLength(2);
    const bySku = new Map(synced?.lines.map((line) => [line.sku.value, line.qty]));
    expect(bySku.get(SKU_A.value)).toBe(draftPoQtyFromUncovered(584, 100));
    expect(bySku.get(SKU_B.value)).toBe(draftPoQtyFromUncovered(40, null));
  });

  it("removes lines no longer uncovered and clears the draft when nothing remains", async () => {
    const h = await harness();
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });

    seedUncovered(h, [
      { sku: SKU_A, uncovered: 12, committed: 12, onHand: 0, onOrder: 0 },
    ]);

    const created = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      lines: [{ sku: SKU_A.value, qty: 48 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    h.uncoveredList.clear(DEFAULT_ORG);

    const result = await h.syncDrafts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.clearedSupplierIds).toEqual([SUPPLIER_A]);
    expect(result.syncedSupplierIds).toEqual([]);

    const cleared = await h.uow.purchaseOrders.findById(
      DEFAULT_ORG,
      created.purchaseOrder.id,
    );
    expect(cleared?.lines).toEqual([]);
  });

  it("syncs only the newest draft when multiple drafts exist for one supplier", async () => {
    const h = await harness();
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });

    seedUncovered(h, [
      { sku: SKU_A, uncovered: 24, committed: 24, onHand: 0, onOrder: 0 },
    ]);
    h.caseQty.set(DEFAULT_ORG, SKU_A.value, 12);

    const older = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      lines: [{ sku: SKU_A.value, qty: 1 }],
    });
    expect(older.ok).toBe(true);
    if (!older.ok) {
      return;
    }

    h.clock.advance(60_000);

    const newer = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      lines: [{ sku: SKU_A.value, qty: 2 }],
    });
    expect(newer.ok).toBe(true);
    if (!newer.ok) {
      return;
    }

    const result = await h.syncDrafts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.purchaseOrderIds).toEqual([newer.purchaseOrder.id]);
    expect(result.syncedSupplierIds).toEqual([SUPPLIER_A]);

    const synced = await h.uow.purchaseOrders.findById(
      DEFAULT_ORG,
      newer.purchaseOrder.id,
    );
    expect(synced?.lines[0]?.qty).toBe(draftPoQtyFromUncovered(24, 12));

    const untouched = await h.uow.purchaseOrders.findById(
      DEFAULT_ORG,
      older.purchaseOrder.id,
    );
    expect(untouched?.lines[0]?.qty).toBe(1);
  });

  it("filters by supplierIds when provided", async () => {
    const h = await harness();
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_B,
      sku: SKU_C.value,
    });

    seedUncovered(h, [
      { sku: SKU_A, uncovered: 10, committed: 10, onHand: 0, onOrder: 0 },
      { sku: SKU_C, uncovered: 20, committed: 20, onHand: 0, onOrder: 0 },
    ]);

    const poA = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      lines: [{ sku: SKU_A.value, qty: 1 }],
    });
    const poB = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_B,
      lines: [{ sku: SKU_C.value, qty: 1 }],
    });
    expect(poA.ok && poB.ok).toBe(true);
    if (!poA.ok || !poB.ok) {
      return;
    }

    const result = await h.syncDrafts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierIds: [SUPPLIER_A],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.purchaseOrderIds).toEqual([poA.purchaseOrder.id]);
    expect(result.syncedSupplierIds).toEqual([SUPPLIER_A]);

    const skipped = await h.uow.purchaseOrders.findById(
      DEFAULT_ORG,
      poB.purchaseOrder.id,
    );
    expect(skipped?.lines[0]?.qty).toBe(1);
  });

  it("returns invalid when replace lines fails", async () => {
    const h = await harness();
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });

    seedUncovered(h, [
      { sku: SKU_A, uncovered: 12, committed: 12, onHand: 0, onOrder: 0 },
    ]);

    const created = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      lines: [{ sku: SKU_A.value, qty: 48 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    h.catalog.set(DEFAULT_ORG, SKU_A.value, "Widget A", { archived: true });

    const result = await h.syncDrafts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });

    const unchanged = await h.uow.purchaseOrders.findById(
      DEFAULT_ORG,
      created.purchaseOrder.id,
    );
    expect(unchanged?.lines[0]?.qty).toBe(48);
  });

  it("returns an empty result when no draft purchase orders exist", async () => {
    const h = await harness();
    const result = await h.syncDrafts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
    });
    expect(result).toEqual({
      ok: true,
      purchaseOrderIds: [],
      syncedSupplierIds: [],
      clearedSupplierIds: [],
      unmappedSkus: [],
    });
  });

  it("loads uncovered and mappings once and uses one unit of work without listing all drafts", async () => {
    const h = await harness();
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });

    seedUncovered(h, [
      { sku: SKU_A, uncovered: 12, committed: 12, onHand: 0, onOrder: 0 },
    ]);

    const created = await h.createPurchaseOrder.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      lines: [{ sku: SKU_A.value, qty: 1 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const listAll = vi.spyOn(h.uncoveredList, "listAll");
    const getSkuMappings = vi.spyOn(h.supplierMapping, "getSkuMappings");
    const readBySkus = vi.spyOn(h.caseQty, "readBySkus");
    const listDrafts = vi.spyOn(h.uow.purchaseOrders, "list");
    const listNewestDrafts = vi.spyOn(h.uow.purchaseOrders, "listNewestDraftsBySuppliers");
    const uowRun = vi.spyOn(h.uow, "run");

    const result = await h.syncDrafts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
    });

    expect(result.ok).toBe(true);
    expect(listAll).toHaveBeenCalledTimes(1);
    expect(readBySkus).toHaveBeenCalledTimes(1);
    expect(listDrafts).not.toHaveBeenCalled();
    expect(listNewestDrafts).toHaveBeenCalledTimes(1);
    expect(listNewestDrafts).toHaveBeenCalledWith({
      organizationId: DEFAULT_ORG,
      supplierIds: undefined,
    });
    expect(uowRun).toHaveBeenCalledTimes(1);
    expect(getSkuMappings).toHaveBeenCalledTimes(1);
  });
});
