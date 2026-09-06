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
  InMemoryUncoveredSkuSupplierMappingReadPort,
  InMemoryUncoveredSkuSupplierReadPort,
} from "../src/adapters/in-memory-uncovered-sku-enrichment.js";
import { ListUncoveredFactoriesUseCase } from "../src/application/list-uncovered-factories.js";
import { ListUncoveredSkusUseCase } from "../src/application/list-uncovered-skus.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const SUPPLIER_A = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SUPPLIER_B = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU_A = Sku.parse("FACTORY-A");
const SKU_B = Sku.parse("FACTORY-B");
const SKU_UNMAPPED = Sku.parse("FACTORY-X");
const SKU_AMBIGUOUS = Sku.parse("FACTORY-AMB");

function harness() {
  const h = demandModelHarness();
  const uncoveredList = new InMemoryUncoveredListQuery(h.readModel);
  const supplierMapping = new InMemoryUncoveredSkuSupplierMappingReadPort();
  const suppliers = new InMemoryUncoveredSkuSupplierReadPort();
  suppliers.set(DEFAULT_ORG, {
    supplierId: SUPPLIER_A,
    supplierNumber: "V-A",
    supplierName: "Factory A",
  });
  suppliers.set(DEFAULT_ORG, {
    supplierId: SUPPLIER_B,
    supplierNumber: "V-B",
    supplierName: "Factory B",
  });
  const openDraftPurchaseOrders = new InMemoryUncoveredSkuDraftPurchaseOrderReadPort();
  return {
    ...h,
    supplierMapping,
    suppliers,
    openDraftPurchaseOrders,
    listFactories: new ListUncoveredFactoriesUseCase(
      uncoveredList,
      supplierMapping,
      suppliers,
    ),
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
    h.supplierMapping.set(DEFAULT_ORG, SKU_A.value, {
      status: "mapped",
      supplierId: SUPPLIER_A,
    });
    h.supplierMapping.set(DEFAULT_ORG, SKU_B.value, {
      status: "mapped",
      supplierId: SUPPLIER_B,
    });
    h.supplierMapping.set(DEFAULT_ORG, SKU_UNMAPPED.value, {
      status: "unmapped",
      supplierId: null,
    });
    h.supplierMapping.set(DEFAULT_ORG, SKU_AMBIGUOUS.value, {
      status: "ambiguous",
      supplierId: null,
    });

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

    const result = await h.listFactories.execute({ organizationId: DEFAULT_ORG });

    expect(result.items).toEqual([
      {
        supplierId: SUPPLIER_A,
        supplierNumber: "V-A",
        supplierName: "Factory A",
        productCount: 1,
        totalUncoveredUnits: 120,
        needsMapping: false,
      },
      {
        supplierId: SUPPLIER_B,
        supplierNumber: "V-B",
        supplierName: "Factory B",
        productCount: 1,
        totalUncoveredUnits: 40,
        needsMapping: false,
      },
      {
        supplierId: null,
        supplierNumber: null,
        supplierName: "Needs mapping",
        productCount: 2,
        totalUncoveredUnits: 35,
        needsMapping: true,
      },
    ]);
  });
});

describe("List uncovered SKUs enrichment", () => {
  it("filters by supplierId and needsMapping and returns draft PO refs", async () => {
    const h = harness();
    h.supplierMapping.set(DEFAULT_ORG, SKU_A.value, {
      status: "mapped",
      supplierId: SUPPLIER_A,
    });
    h.supplierMapping.set(DEFAULT_ORG, SKU_UNMAPPED.value, {
      status: "unmapped",
      supplierId: null,
    });

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
});
