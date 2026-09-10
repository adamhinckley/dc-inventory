import {
  MissingOrganizationContextError,
  OrganizationId,
  PurchaseOrderId,
  Sku,
  LocationId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { InMemoryUncoveredListQuery } from "../src/adapters/in-memory-uncovered-list-query.js";
import type { IUncoveredListQuery } from "../src/domain/ports/uncovered-list-query.js";
import {
  InMemoryUncoveredCaseQtyReadPort,
  InMemoryUncoveredReorderPolicyReadPort,
} from "../src/adapters/in-memory-uncovered-stock-context.js";
import {
  InMemoryUncoveredSkuDraftPurchaseOrderReadPort,
  InMemoryUncoveredSkuSupplierMappingReadPort,
  InMemoryUncoveredSkuSupplierReadPort,
} from "../src/adapters/in-memory-uncovered-sku-enrichment.js";
import { ListUncoveredSkusUseCase } from "../src/application/list-uncovered-skus.js";
import { computeUncovered } from "../src/domain/demand-model.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

const OPEN_SKU = Sku.parse("UNCOVERED-OPEN-1");
const COVER_SKU = Sku.parse("UNCOVERED-COVER-1");
const FLOOR_SKU = Sku.parse("UNCOVERED-FLOOR-1");
const SORT_B = Sku.parse("UNCOVERED-B");
const SORT_A = Sku.parse("UNCOVERED-A");
const COLON_SKU = Sku.parse("STYLE:COLOR");

const SO_OPEN = "550e8400-e29b-41d4-a716-446655440070";
const SO_COVER = "550e8400-e29b-41d4-a716-446655440071";
const SO_FLOOR = "550e8400-e29b-41d4-a716-446655440072";
const SO_COLON = "550e8400-e29b-41d4-a716-446655440073";
const PO_COVER = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440080");
const FILTER_SUPPLIER = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const FILTER_SKU = Sku.parse("FILTER-SUPPLIER-SKU");
const FILTER_UNMAPPED_SKU = Sku.parse("FILTER-UNMAPPED-SKU");

function harness() {
  const h = demandModelHarness();
  const supplierMapping = new InMemoryUncoveredSkuSupplierMappingReadPort();
  const uncoveredList = new InMemoryUncoveredListQuery(h.readModel, { supplierMapping });
  const caseQty = new InMemoryUncoveredCaseQtyReadPort();
  const reorderPolicies = new InMemoryUncoveredReorderPolicyReadPort();
  const suppliers = new InMemoryUncoveredSkuSupplierReadPort();
  const openDraftPurchaseOrders = new InMemoryUncoveredSkuDraftPurchaseOrderReadPort();
  return {
    ...h,
    caseQty,
    reorderPolicies,
    supplierMapping,
    suppliers,
    openDraftPurchaseOrders,
    readModel: h.readModel,
    listUncovered: new ListUncoveredSkusUseCase(
      uncoveredList,
      caseQty,
      reorderPolicies,
      supplierMapping,
      suppliers,
      openDraftPurchaseOrders,
    ),
  };
}

const unmappedEnrichment = {
  supplierId: null,
  supplierNumber: null,
  supplierName: null,
  mappingStatus: "unmapped" as const,
  draftPurchaseOrder: null,
};

describe("List uncovered SKUs — demand-to-PO query (ADA-180)", () => {
  it("lists open pre-sell with no PO at full committed qty", async () => {
    const h = harness();
    const commit = await h.committed({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "open-commit-1200",
      sku: OPEN_SKU,
      quantity: 1_200,
      refType: "sales_order",
      refId: SO_OPEN,
    });
    expect(commit.ok).toBe(true);

    const result = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        sku: OPEN_SKU,
        committed: 1_200,
        onHand: 0,
        onOrder: 0,
        uncovered: computeUncovered(1_200, 0, 0),
        caseQty: null,
        reorderMin: null,
        reorderMax: null,
        ...unmappedEnrichment,
      },
    ]);
  });

  it("drops a SKU after a covering PO and does not invent extra floor qty", async () => {
    const h = harness();
    await h.adjustmentIncrease.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "cover-floor-500",
      sku: COVER_SKU,
      quantity: 500,
      refType: "adjustment",
      refId: "cover-floor-500",
    });

    const commit = await h.committed({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "cover-commit-1200",
      sku: COVER_SKU,
      quantity: 1_200,
      refType: "sales_order",
      refId: SO_COVER,
    });
    expect(commit.ok).toBe(true);

    const beforePo = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
    });
    expect(beforePo.total).toBe(1);
    expect(beforePo.items[0]).toMatchObject({
      sku: COVER_SKU,
      committed: 1_200,
      onHand: 500,
      onOrder: 0,
      uncovered: 700,
    });

    const inbound = await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "cover-po-1900",
      sku: COVER_SKU,
      quantity: 1_900,
      refType: "purchase_order",
      refId: PO_COVER,
    });
    expect(inbound.ok).toBe(true);

    const afterPo = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
    });
    expect(afterPo.total).toBe(0);
    expect(afterPo.items).toEqual([]);
  });

  it("does not list SKUs when on-hand alone covers committed demand", async () => {
    const h = harness();
    await h.adjustmentIncrease.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "floor-2000",
      sku: FLOOR_SKU,
      quantity: 2_000,
      refType: "adjustment",
      refId: "floor-2000",
    });

    const commit = await h.committed({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "floor-commit-1200",
      sku: FLOOR_SKU,
      quantity: 1_200,
      refType: "sales_order",
      refId: SO_FLOOR,
    });
    expect(commit.ok).toBe(true);

    const result = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
    });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("lists SKUs whose code contains a colon", async () => {
    const h = harness();
    const commit = await h.committed({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "colon-commit-800",
      sku: COLON_SKU,
      quantity: 800,
      refType: "sales_order",
      refId: SO_COLON,
    });
    expect(commit.ok).toBe(true);

    const result = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      sku: COLON_SKU,
      committed: 800,
      onHand: 0,
      onOrder: 0,
      uncovered: computeUncovered(800, 0, 0),
    });
  });

  it("sorts by sku ascending and paginates", async () => {
    const h = harness();
    for (const [sku, key] of [
      [SORT_B, "sort-b"],
      [SORT_A, "sort-a"],
    ] as const) {
      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `${key}-commit`,
        sku,
        quantity: 10,
        refType: "sales_order",
        refId: `${key}-so`,
      });
      expect(commit.ok).toBe(true);
    }

    const page1 = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 1,
    });
    expect(page1.total).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]?.sku.value).toBe(SORT_A.value);

    const page2 = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 2,
      pageSize: 1,
    });
    expect(page2.total).toBe(2);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.sku.value).toBe(SORT_B.value);
  });

  it("scopes results to the requested organization", async () => {
    const h = harness();
    const commit = await h.committed({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "org-default-commit",
      sku: OPEN_SKU,
      quantity: 50,
      refType: "sales_order",
      refId: "org-default-so",
    });
    expect(commit.ok).toBe(true);

    const otherCommit = await h.committed({
      organizationId: BETA_ORG,
      idempotencyKey: "org-other-commit",
      sku: OPEN_SKU,
      quantity: 75,
      refType: "sales_order",
      refId: "org-other-so",
    });
    expect(otherCommit.ok).toBe(true);

    const defaultResult = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
    });
    expect(defaultResult.total).toBe(1);
    expect(defaultResult.items[0]?.committed).toBe(50);

    const otherResult = await h.listUncovered.execute({
      organizationId: BETA_ORG,
      page: 1,
      pageSize: 50,
    });
    expect(otherResult.total).toBe(1);
    expect(otherResult.items[0]?.committed).toBe(75);
  });

  it("throws when organizationId is omitted", async () => {
    const h = harness();
    await expect(
      h.listUncovered.execute({
        page: 1,
        pageSize: 50,
      } as Parameters<typeof h.listUncovered.execute>[0]),
    ).rejects.toThrow(MissingOrganizationContextError);
  });

  it("joins catalog case qty and reorder min/max without changing uncovered math", async () => {
    const h = harness();
    const commit = await h.committed({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "join-commit-500",
      sku: OPEN_SKU,
      quantity: 500,
      refType: "sales_order",
      refId: "join-so",
    });
    expect(commit.ok).toBe(true);
    h.caseQty.set(DEFAULT_ORG, OPEN_SKU.value, 100);
    h.reorderPolicies.set(DEFAULT_ORG, LocationId.DEFAULT, OPEN_SKU.value, 24, 120);

    const result = await h.listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 50,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      sku: OPEN_SKU,
      committed: 500,
      onHand: 0,
      onOrder: 0,
      uncovered: computeUncovered(500, 0, 0),
      caseQty: 100,
      reorderMin: 24,
      reorderMax: 120,
      ...unmappedEnrichment,
    });
  });

  it("does not call listAll when filtering by supplierId or needsMapping", async () => {
    const h = harness();
    h.supplierMapping.set(DEFAULT_ORG, FILTER_SKU.value, {
      status: "mapped",
      supplierId: FILTER_SUPPLIER,
    });

    for (const [sku, key] of [
      [FILTER_SKU, "filter-mapped"],
      [FILTER_UNMAPPED_SKU, "filter-unmapped"],
    ] as const) {
      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `${key}-commit`,
        sku,
        quantity: 30,
        refType: "sales_order",
        refId: `${key}-so`,
      });
      expect(commit.ok).toBe(true);
    }

    const inner = new InMemoryUncoveredListQuery(h.readModel, {
      supplierMapping: h.supplierMapping,
    });
    const listAll = vi.spyOn(inner, "listAll");
    const trackingList: IUncoveredListQuery = {
      list: (query) => inner.list(query),
      listAll: (...args) => inner.listAll(...args),
      listFactories: (query) => inner.listFactories(query),
    };
    const listUncovered = new ListUncoveredSkusUseCase(
      trackingList,
      h.caseQty,
      h.reorderPolicies,
      h.supplierMapping,
      h.suppliers,
      h.openDraftPurchaseOrders,
    );

    await listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
      supplierId: FILTER_SUPPLIER,
    });
    await listUncovered.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
      needsMapping: true,
    });

    expect(listAll).not.toHaveBeenCalled();
  });
});
