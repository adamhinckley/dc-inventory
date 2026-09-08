import {
  InMemoryUncoveredCaseQtyReadPort,
} from "@dc-inventory/inventory";
import {
  OrganizationId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryCatalogSkuLookupPort } from "../src/adapters/in-memory-catalog-sku-lookup.js";
import { InMemoryPurchasingUnitOfWork } from "../src/adapters/in-memory-purchasing-unit-of-work.js";
import { InMemorySupplierProductRepository } from "../src/adapters/in-memory-supplier-product-repository.js";
import { InMemorySupplierSkuMappingReadPort } from "../src/adapters/in-memory-supplier-sku-mapping.js";
import { DraftPurchaseOrdersFromUncoveredSkusUseCase } from "../src/application/draft-purchase-orders-from-uncovered-skus.js";
import { groupUncoveredSkusBySupplier } from "../src/application/group-uncovered-skus-by-supplier.js";
import { AssignSupplierProductUseCase } from "../src/application/assign-supplier-product.js";
import { SupplierProductId } from "../src/domain/ids.js";
import type { IInventoryUncoveredReadPort } from "../src/domain/ports/short-readout.js";

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

class StubUncoveredPort implements IInventoryUncoveredReadPort {
  private readonly values = new Map<string, number>();

  set(sku: string, uncovered: number): void {
    this.values.set(sku, uncovered);
  }

  async getUncovered(_organizationId: OrganizationId, sku: Sku): Promise<number> {
    return this.values.get(sku.value) ?? 0;
  }
}

async function harness() {
  const uow = new InMemoryPurchasingUnitOfWork();
  const catalog = new InMemoryCatalogSkuLookupPort();
  const supplierProducts = new InMemorySupplierProductRepository();
  const uncovered = new StubUncoveredPort();
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
  const draftFromUncovered = new DraftPurchaseOrdersFromUncoveredSkusUseCase(
    supplierMapping,
    uncovered,
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
    poPrefix: null,
  });
  await uow.suppliers.save({
    id: SUPPLIER_B,
    organizationId: DEFAULT_ORG,
    vendorNumber: "FB",
    name: "Factory B",
    poPrefix: null,
  });

  return {
    uow,
    catalog,
    supplierProducts,
    uncovered,
    caseQty,
    assignProduct,
    draftFromUncovered,
  };
}

describe("groupUncoveredSkusBySupplier", () => {
  it("splits lines by supplier and omits unmapped SKUs", () => {
    const result = groupUncoveredSkusBySupplier({
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

describe("DraftPurchaseOrdersFromUncoveredSkusUseCase", () => {
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

    h.uncovered.set(SKU_A.value, 584);
    h.uncovered.set(SKU_B.value, 40);
    h.uncovered.set(SKU_UNMAPPED.value, 25);
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

    h.uncovered.set(SKU_A.value, 12);
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

    h.uncovered.set(SKU_A.value, 12);
    h.uncovered.set(SKU_B.value, 12);
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
