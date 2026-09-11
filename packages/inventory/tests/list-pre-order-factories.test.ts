import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryPreOrderListQuery } from "../src/adapters/in-memory-pre-order-list-query.js";
import {
  InMemoryPreOrderCaseQtyReadPort,
  InMemoryPreOrderReorderPolicyReadPort,
} from "../src/adapters/in-memory-pre-order-stock-context.js";
import {
  InMemoryUncoveredSkuDraftPurchaseOrderReadPort,
  InMemoryUncoveredSkuSupplierReadPort,
} from "../src/adapters/in-memory-pre-order-sku-enrichment.js";
import {
  ListPreOrderFactoriesUseCase,
  PRE_ORDER_NEEDS_MAPPING_FACTORY_ROW_ID,
} from "../src/application/list-pre-order-factories.js";
import { ListPreOrderSkusUseCase } from "../src/application/list-pre-order-skus.js";
import type {
  IPreOrderSkuSupplierMappingReadPort,
  PreOrderSkuSupplierMapping,
} from "../src/domain/ports/pre-order-sku-enrichment.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const SUPPLIER_A = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SUPPLIER_B = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU_A = Sku.parse("FACTORY-A");
const SKU_B = Sku.parse("FACTORY-B");
const SKU_UNMAPPED = Sku.parse("FACTORY-X");
const SKU_AMBIGUOUS = Sku.parse("FACTORY-AMB");

function resolveSupplierSkuMapping(
  supplierIds: readonly SupplierId[],
): PreOrderSkuSupplierMapping {
  if (supplierIds.length === 0) {
    return { status: "unmapped", supplierId: null };
  }
  if (supplierIds.length === 1) {
    return { status: "mapped", supplierId: supplierIds[0] ?? null };
  }
  return { status: "ambiguous", supplierId: null };
}

/** Mirrors supplier-product resolution used by ISupplierSkuMappingReadPort. */
class TestSupplierSkuMappingReadPort implements IPreOrderSkuSupplierMappingReadPort {
  private readonly supplierIdsBySku = new Map<string, SupplierId[]>();

  assign(sku: Sku, supplierId: SupplierId): void {
    const existing = this.supplierIdsBySku.get(sku.value) ?? [];
    existing.push(supplierId);
    this.supplierIdsBySku.set(sku.value, existing);
  }

  async getSkuMappings(
    _organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, PreOrderSkuSupplierMapping>> {
    const mappings = new Map<string, PreOrderSkuSupplierMapping>();
    for (const sku of skus) {
      mappings.set(
        sku.value,
        resolveSupplierSkuMapping(this.supplierIdsBySku.get(sku.value) ?? []),
      );
    }
    return mappings;
  }
}

function harness() {
  const h = demandModelHarness();
  const supplierMapping = new TestSupplierSkuMappingReadPort();
  const openDraftPurchaseOrders = new InMemoryUncoveredSkuDraftPurchaseOrderReadPort();
  const suppliers = new InMemoryUncoveredSkuSupplierReadPort();
  const preOrderList = new InMemoryPreOrderListQuery(h.readModel, {
    supplierMapping,
    suppliers,
    openDraftPurchaseOrders,
  });
  suppliers.set(DEFAULT_ORG, {
    supplierId: SUPPLIER_A,
    supplierNumber: "V-A",
    supplierName: "Factory A",
    poPrefix: "FA",
  });
  suppliers.set(DEFAULT_ORG, {
    supplierId: SUPPLIER_B,
    supplierNumber: "V-B",
    supplierName: "Factory B",
    poPrefix: null,
  });
  return {
    ...h,
    supplierMapping,
    suppliers,
    openDraftPurchaseOrders,
    listFactories: new ListPreOrderFactoriesUseCase(preOrderList, suppliers),
    listUncovered: new ListPreOrderSkusUseCase(
      preOrderList,
      new InMemoryPreOrderCaseQtyReadPort(),
      new InMemoryPreOrderReorderPolicyReadPort(),
      supplierMapping,
      suppliers,
      openDraftPurchaseOrders,
    ),
  };
}

describe("List toOrder factories", () => {
  it("aggregates mapped SKUs by supplier and adds a needs-mapping row", async () => {
    const h = harness();
    h.supplierMapping.assign(SKU_A, SUPPLIER_A);
    h.supplierMapping.assign(SKU_B, SUPPLIER_B);
    h.supplierMapping.assign(SKU_AMBIGUOUS, SUPPLIER_A);
    h.supplierMapping.assign(SKU_AMBIGUOUS, SUPPLIER_B);

    for (const [sku, qty, key] of [
      [SKU_A, 120, "factory-a"],
      [SKU_B, 40, "factory-b"],
      [SKU_UNMAPPED, 25, "factory-x"],
      [SKU_AMBIGUOUS, 10, "factory-amb"],
    ] as const) {
      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `${key}-commit`,
        sku,
        quantity: qty,
        refType: "sales_order",
        refId: `${key}-so`,
      });
      expect(commit.ok).toBe(true);
    }

    const result = await h.listFactories.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
    });

    expect(result.items).toEqual([
      {
        id: SUPPLIER_A,
        supplierId: SUPPLIER_A,
        supplierNumber: "V-A",
        supplierName: "Factory A",
        poPrefix: "FA",
        productCount: 1,
        totalToOrderUnits: 120,
        needsMapping: false,
      },
      {
        id: SUPPLIER_B,
        supplierId: SUPPLIER_B,
        supplierNumber: "V-B",
        supplierName: "Factory B",
        poPrefix: null,
        productCount: 1,
        totalToOrderUnits: 40,
        needsMapping: false,
      },
      {
        id: PRE_ORDER_NEEDS_MAPPING_FACTORY_ROW_ID,
        supplierId: null,
        supplierNumber: null,
        supplierName: "Needs mapping",
        poPrefix: null,
        productCount: 2,
        totalToOrderUnits: 35,
        needsMapping: true,
      },
    ]);
  });

  it("excludes mapped factories whose supplier already has an open draft PO when requested", async () => {
    const h = harness();
    h.supplierMapping.assign(SKU_A, SUPPLIER_A);
    h.supplierMapping.assign(SKU_B, SUPPLIER_B);

    for (const [sku, qty, key] of [
      [SKU_A, 120, "draft-filter-a"],
      [SKU_B, 40, "draft-filter-b"],
      [SKU_UNMAPPED, 25, "draft-filter-x"],
    ] as const) {
      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `${key}-commit`,
        sku,
        quantity: qty,
        refType: "sales_order",
        refId: `${key}-so`,
      });
      expect(commit.ok).toBe(true);
    }

    h.openDraftPurchaseOrders.set(DEFAULT_ORG, SUPPLIER_A, SKU_A, {
      id: PurchaseOrderId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
      documentNumber: "PO-00042",
    });

    const unfiltered = await h.listFactories.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
    });
    expect(unfiltered.items.map((row) => row.id)).toEqual([
      SUPPLIER_A,
      SUPPLIER_B,
      PRE_ORDER_NEEDS_MAPPING_FACTORY_ROW_ID,
    ]);

    const filtered = await h.listFactories.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
      excludeSuppliersWithOpenDraft: true,
    });
    expect(filtered.items).toEqual([
      {
        id: SUPPLIER_B,
        supplierId: SUPPLIER_B,
        supplierNumber: "V-B",
        supplierName: "Factory B",
        poPrefix: null,
        productCount: 1,
        totalToOrderUnits: 40,
        needsMapping: false,
      },
      {
        id: PRE_ORDER_NEEDS_MAPPING_FACTORY_ROW_ID,
        supplierId: null,
        supplierNumber: null,
        supplierName: "Needs mapping",
        poPrefix: null,
        productCount: 1,
        totalToOrderUnits: 25,
        needsMapping: true,
      },
    ]);
  });
});

describe("List toOrder SKUs enrichment", () => {
  it("filters by supplierId and needsMapping and returns draft PO refs", async () => {
    const h = harness();
    h.supplierMapping.assign(SKU_A, SUPPLIER_A);

    for (const [sku, qty, key] of [
      [SKU_A, 50, "enrich-a"],
      [SKU_UNMAPPED, 15, "enrich-x"],
    ] as const) {
      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `${key}-commit`,
        sku,
        quantity: qty,
        refType: "sales_order",
        refId: `${key}-so`,
      });
      expect(commit.ok).toBe(true);
    }

    h.openDraftPurchaseOrders.set(DEFAULT_ORG, SUPPLIER_A, SKU_A, {
      id: PurchaseOrderId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
      documentNumber: "PO-00042",
    });

    const bySupplier = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
      supplierId: SUPPLIER_A,
    });
    expect(bySupplier.total).toBe(1);
    expect(bySupplier.items[0]).toMatchObject({
      sku: SKU_A,
      toOrder: 50,
      supplierId: SUPPLIER_A,
      mappingStatus: "mapped",
      draftPurchaseOrder: {
        id: PurchaseOrderId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
        documentNumber: "PO-00042",
      },
    });

    const needsMapping = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
      needsMapping: true,
    });
    expect(needsMapping.total).toBe(1);
    expect(needsMapping.items[0]).toMatchObject({
      sku: SKU_UNMAPPED,
      mappingStatus: "unmapped",
      draftPurchaseOrder: null,
    });
  });

  it("resolves ambiguous mapping from multi-supplier SKU assignments", async () => {
    const h = harness();
    h.supplierMapping.assign(SKU_AMBIGUOUS, SUPPLIER_A);
    h.supplierMapping.assign(SKU_AMBIGUOUS, SUPPLIER_B);

    const commit = await h.committed({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "ambiguous-commit",
      sku: SKU_AMBIGUOUS,
      quantity: 18,
      refType: "sales_order",
      refId: "ambiguous-so",
    });
    expect(commit.ok).toBe(true);

    const listed = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
    });
    expect(listed.items[0]).toMatchObject({
      sku: SKU_AMBIGUOUS,
      supplierId: null,
      supplierNumber: null,
      supplierName: null,
      mappingStatus: "ambiguous",
      draftPurchaseOrder: null,
    });

    const needsMapping = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
      needsMapping: true,
    });
    expect(needsMapping.total).toBe(1);
    expect(needsMapping.items[0]?.sku).toEqual(SKU_AMBIGUOUS);

    const bySupplierA = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
      supplierId: SUPPLIER_A,
    });
    expect(bySupplierA.total).toBe(0);
    expect(bySupplierA.items).toEqual([]);
  });
});
