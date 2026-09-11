import {
  InMemoryPreOrderCaseQtyReadPort,
} from "@dc-inventory/inventory";
import {
  OrganizationId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { InMemoryCatalogSkuLookupPort } from "../src/adapters/in-memory-catalog-sku-lookup.js";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import { InMemorySupplierProductRepository } from "../src/adapters/in-memory-supplier-product-repository.js";
import { InMemorySupplierSkuMappingReadPort } from "../src/adapters/in-memory-supplier-sku-mapping.js";
import { DraftPurchaseOrdersFromPreOrderSkusUseCase } from "../src/application/draft-purchase-orders-from-pre-order-skus.js";
import { groupPreOrderSkusBySupplier } from "../src/application/group-pre-order-skus-by-supplier.js";
import { AssignSupplierProductUseCase } from "../src/application/assign-supplier-product.js";
import { SupplierProductId } from "../src/domain/ids.js";
import type { IInventoryToOrderReadPort } from "../src/domain/ports/short-readout.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const SUPPLIER_A = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SUPPLIER_B = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU_A = Sku.parse("UNCOVERED-DRAFT-A");
const SKU_B = Sku.parse("UNCOVERED-DRAFT-B");
const SKU_UNMAPPED = Sku.parse("UNCOVERED-DRAFT-X");

/** Mirrors apps/internal/src/lib/purchase-order-line-math.ts suggestedDraftPoQty. */
function suggestedDraftPoQty(need: number, caseQty: number | null): number {
  if (need <= 0) {
    return 1;
  }
  if (caseQty === null || caseQty <= 0) {
    return need;
  }
  return Math.ceil(need / caseQty) * caseQty;
}

class StubUncoveredPort implements IInventoryToOrderReadPort {
  private readonly values = new Map<string, number>();

  set(sku: string, toOrder: number): void {
    this.values.set(sku, toOrder);
  }

  async getToOrder(_organizationId: OrganizationId, sku: Sku): Promise<number> {
    return this.values.get(sku.value) ?? 0;
  }

  async getToOrderBySkus(
    _organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, number>> {
    const rows = new Map<string, number>();
    for (const sku of skus) {
      rows.set(sku.value, this.values.get(sku.value) ?? 0);
    }
    return rows;
  }
}

async function harness() {
  const uow = new InMemoryPurchasingUnitOfWork();
  const catalog = new InMemoryCatalogSkuLookupPort();
  const supplierProducts = new InMemorySupplierProductRepository();
  const toOrder = new StubUncoveredPort();
  const caseQty = new InMemoryPreOrderCaseQtyReadPort();
  const supplierMapping = new InMemorySupplierSkuMappingReadPort(
    uow.suppliers,
    supplierProducts,
  );
  const assignProduct = new AssignSupplierProductUseCase(
    uow.suppliers,
    supplierProducts,
    catalog,
  );
  const draftFromUncovered = new DraftPurchaseOrdersFromPreOrderSkusUseCase(
    supplierMapping,
    toOrder,
    caseQty,
    uow,
    catalog,
  );

  catalog.set(DEFAULT_ORG, SKU_A.value, "Widget A");
  catalog.set(DEFAULT_ORG, SKU_B.value, "Widget B");
  catalog.set(DEFAULT_ORG, SKU_UNMAPPED.value, "Widget X");

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
    uow,
    catalog,
    supplierProducts,
    supplierMapping,
    toOrder,
    caseQty,
    assignProduct,
    draftFromUncovered,
  };
}

describe("groupPreOrderSkusBySupplier", () => {
  it("splits lines by supplier and omits unmapped SKUs", () => {
    const result = groupPreOrderSkusBySupplier({
      lines: [
        { sku: SKU_A, qty: 48 },
        { sku: SKU_B, qty: 96 },
        { sku: SKU_UNMAPPED, qty: 12 },
      ],
      supplierForSku: (sku) => {
        if (sku.value === SKU_A.value) {
          return SUPPLIER_A;
        }
        if (sku.value === SKU_B.value) {
          return SUPPLIER_B;
        }
        return null;
      },
    });

    expect(result.unmappedSkus).toEqual([SKU_UNMAPPED.value]);
    expect(result.bySupplier.get(SUPPLIER_A)).toEqual([{ sku: SKU_A, qty: 48 }]);
    expect(result.bySupplier.get(SUPPLIER_B)).toEqual([{ sku: SKU_B, qty: 96 }]);
    expect(result.bySupplier.size).toBe(2);
  });
});

describe("DraftPurchaseOrdersFromPreOrderSkusUseCase", () => {
  it("creates one draft per supplier with suggested qty and omits unmapped SKUs", async () => {
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
      sku: SKU_B.value,
    });

    h.toOrder.set(SKU_A.value, 584);
    h.toOrder.set(SKU_B.value, 40);
    h.toOrder.set(SKU_UNMAPPED.value, 25);
    h.caseQty.set(DEFAULT_ORG, SKU_A.value, 100);
    h.caseQty.set(DEFAULT_ORG, SKU_B.value, null);

    const result = await h.draftFromUncovered.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      skus: [SKU_A.value, SKU_B.value, SKU_UNMAPPED.value],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.unmappedSkus).toEqual([SKU_UNMAPPED.value]);
    expect(result.purchaseOrders).toHaveLength(2);

    const bySupplier = new Map(
      result.purchaseOrders.map((po) => [po.supplierId, po]),
    );
    const poA = bySupplier.get(SUPPLIER_A);
    const poB = bySupplier.get(SUPPLIER_B);
    expect(poA).toBeDefined();
    expect(poB).toBeDefined();
    if (poA === undefined || poB === undefined) {
      return;
    }
    expect(poA.status).toBe("draft");
    expect(poB.status).toBe("draft");
    expect(poA?.lines).toEqual([
      {
        id: poA.lines[0]?.id,
        sku: SKU_A,
        name: "Widget A",
        qty: suggestedDraftPoQty(584, 100),
        receivedQty: 0,
      },
    ]);
    expect(poB?.lines).toEqual([
      {
        id: poB.lines[0]?.id,
        sku: SKU_B,
        name: "Widget B",
        qty: suggestedDraftPoQty(40, null),
        receivedQty: 0,
      },
    ]);
    expect(poA?.lines[0]?.qty).toBe(600);
    expect(poB?.lines[0]?.qty).toBe(40);
  });

  it("drafts a PO when the supplier has no PO prefix", async () => {
    const h = await harness();
    await h.uow.suppliers.save({
      id: SUPPLIER_A,
      organizationId: DEFAULT_ORG,
      vendorNumber: "FA",
      name: "Factory A",
      poPrefix: null,
    });
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });
    h.toOrder.set(SKU_A.value, 12);

    const result = await h.draftFromUncovered.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      skus: [SKU_A.value],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.purchaseOrders).toHaveLength(1);
    expect(result.purchaseOrders[0]?.documentNumber).toBe("PO-OP06-00001");
  });

  it("treats ambiguous multi-supplier SKUs as unmapped without failing mapped drafts", async () => {
    const h = await harness();
    await h.assignProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU_A.value,
    });
    await h.supplierProducts.save({
      id: SupplierProductId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
      supplierId: SUPPLIER_B,
      sku: SKU_A,
      supplierSku: "B-A",
      minOrderQty: null,
      minOrderAmountCents: null,
      lastPoCostCents: null,
      currency: "USD",
    });

    h.toOrder.set(SKU_A.value, 12);
    h.caseQty.set(DEFAULT_ORG, SKU_A.value, 48);

    const result = await h.draftFromUncovered.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      skus: [SKU_A.value],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.unmappedSkus).toEqual([SKU_A.value]);
    expect(result.purchaseOrders).toEqual([]);
  });

  it("calls mapping, toOrder, and case-qty ports once for 20+ SKUs", async () => {
    const h = await harness();
    const batchSkus = Array.from({ length: 25 }, (_, index) =>
      Sku.parse(`BATCH-DRAFT-${String(index).padStart(3, "0")}`),
    );

    for (const sku of batchSkus) {
      h.catalog.set(DEFAULT_ORG, sku.value, `Widget ${sku.value}`);
      await h.assignProduct.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        supplierId: SUPPLIER_A,
        sku: sku.value,
      });
      h.toOrder.set(sku.value, 12);
      h.caseQty.set(DEFAULT_ORG, sku.value, 48);
    }

    const getSkuMappings = vi.spyOn(h.supplierMapping, "getSkuMappings");
    const getToOrderBySkus = vi.spyOn(h.toOrder, "getToOrderBySkus");
    const readBySkus = vi.spyOn(h.caseQty, "readBySkus");

    const result = await h.draftFromUncovered.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      skus: batchSkus.map((sku) => sku.value),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.purchaseOrders).toHaveLength(1);
    expect(result.purchaseOrders[0]?.lines).toHaveLength(25);
    expect(getSkuMappings).toHaveBeenCalledTimes(1);
    expect(getToOrderBySkus).toHaveBeenCalledTimes(1);
    expect(readBySkus).toHaveBeenCalledTimes(1);
    expect(getSkuMappings.mock.calls[0]?.[1]).toHaveLength(25);
    expect(getToOrderBySkus.mock.calls[0]?.[1]).toHaveLength(25);
    expect(readBySkus.mock.calls[0]?.[1]).toHaveLength(25);
  });

  it("rolls back earlier drafts when a later supplier create fails", async () => {
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
      sku: SKU_B.value,
    });

    h.toOrder.set(SKU_A.value, 12);
    h.toOrder.set(SKU_B.value, 12);
    h.catalog.set(DEFAULT_ORG, SKU_B.value, "Widget B", { archived: true });

    const result = await h.draftFromUncovered.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      skus: [SKU_A.value, SKU_B.value],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("invalid");

    const listed = await h.uow.purchaseOrders.list({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
      status: "draft",
    });
    expect(listed.total).toBe(0);
  });
});
