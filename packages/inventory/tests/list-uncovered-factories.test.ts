import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryUncoveredListQuery } from "../src/adapters/in-memory-uncovered-list-query.js";
import {
  InMemoryUncoveredCaseQtyReadPort,
  InMemoryUncoveredReorderPolicyReadPort,
} from "../src/adapters/in-memory-uncovered-stock-context.js";
import {
  InMemoryUncoveredSkuDraftPurchaseOrderReadPort,
  InMemoryUncoveredSkuSupplierReadPort,
} from "../src/adapters/in-memory-uncovered-sku-enrichment.js";
import {
  ListUncoveredFactoriesUseCase,
  UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
} from "../src/application/list-uncovered-factories.js";
import { ListUncoveredSkusUseCase } from "../src/application/list-uncovered-skus.js";
import type {
  IUncoveredSkuSupplierMappingReadPort,
  UncoveredSkuSupplierMapping,
} from "../src/domain/ports/uncovered-sku-enrichment.js";
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
): UncoveredSkuSupplierMapping {
  if (supplierIds.length === 0) {
    return { status: "unmapped", supplierId: null };
  }
  if (supplierIds.length === 1) {
    return { status: "mapped", supplierId: supplierIds[0] ?? null };
  }
  return { status: "ambiguous", supplierId: null };
}

/** Mirrors supplier-product resolution used by ISupplierSkuMappingReadPort. */
class TestSupplierSkuMappingReadPort implements IUncoveredSkuSupplierMappingReadPort {
  private readonly supplierIdsBySku = new Map<string, SupplierId[]>();

  assign(sku: Sku, supplierId: SupplierId): void {
    const existing = this.supplierIdsBySku.get(sku.value) ?? [];
    existing.push(supplierId);
    this.supplierIdsBySku.set(sku.value, existing);
  }

  async getSkuMappings(
    _organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, UncoveredSkuSupplierMapping>> {
    const mappings = new Map<string, UncoveredSkuSupplierMapping>();
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
  const uncoveredList = new InMemoryUncoveredListQuery(h.readModel, {
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
    listFactories: new ListUncoveredFactoriesUseCase(uncoveredList, suppliers),
    listUncovered: new ListUncoveredSkusUseCase(
      uncoveredList,
      new InMemoryUncoveredCaseQtyReadPort(),
      new InMemoryUncoveredReorderPolicyReadPort(),
      supplierMapping,
      suppliers,
      openDraftPurchaseOrders,
    ),
  };
}

describe("List uncovered factories", () => {
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
        totalUncoveredUnits: 120,
        needsMapping: false,
      },
      {
        id: SUPPLIER_B,
        supplierId: SUPPLIER_B,
        supplierNumber: "V-B",
        supplierName: "Factory B",
        poPrefix: null,
        productCount: 1,
        totalUncoveredUnits: 40,
        needsMapping: false,
      },
      {
        id: UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
        supplierId: null,
        supplierNumber: null,
        supplierName: "Needs mapping",
        poPrefix: null,
        productCount: 2,
        totalUncoveredUnits: 35,
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
      UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
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
        totalUncoveredUnits: 40,
        needsMapping: false,
      },
      {
        id: UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
        supplierId: null,
        supplierNumber: null,
        supplierName: "Needs mapping",
        poPrefix: null,
        productCount: 1,
        totalUncoveredUnits: 25,
        needsMapping: true,
      },
    ]);
  });
});

describe("List uncovered SKUs enrichment", () => {
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
      uncovered: 50,
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
