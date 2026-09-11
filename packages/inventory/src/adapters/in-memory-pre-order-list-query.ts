import {
  LocationId,
  requireOrganizationId,
  type OrganizationId,
  type Sku,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import type {
  IPreOrderListQuery,
  PreOrderFactoryCoreRow,
  PreOrderFactoryListQuery,
  PreOrderListCoreRow,
  PreOrderListQuery,
} from "../domain/ports/pre-order-list-query.js";
import type {
  IPreOrderSkuDraftPurchaseOrderReadPort,
  IPreOrderSkuSupplierMappingReadPort,
  IPreOrderSkuSupplierReadPort,
  PreOrderSkuSupplierMapping,
} from "../domain/ports/pre-order-sku-enrichment.js";
import { preOrderSkuDraftKey } from "../domain/ports/pre-order-sku-enrichment.js";
import type { InMemoryInventoryReadModel } from "./in-memory-inventory-read-model.js";

function compareRowsBySku(a: PreOrderListCoreRow, b: PreOrderListCoreRow): number {
  return a.sku.value.localeCompare(b.sku.value);
}

function matchesFilter(
  mapping: PreOrderSkuSupplierMapping,
  supplierId: SupplierId | undefined,
  needsMapping: boolean | undefined,
): boolean {
  if (needsMapping === true) {
    return mapping.status !== "mapped";
  }
  if (supplierId !== undefined) {
    return mapping.status === "mapped" && mapping.supplierId === supplierId;
  }
  return true;
}

export type InMemoryPreOrderListQueryDeps = Readonly<{
  supplierMapping: IPreOrderSkuSupplierMappingReadPort;
  suppliers?: IPreOrderSkuSupplierReadPort;
  openDraftPurchaseOrders?: IPreOrderSkuDraftPurchaseOrderReadPort;
}>;

export class InMemoryPreOrderListQuery implements IPreOrderListQuery {
  constructor(
    private readonly readModel: InMemoryInventoryReadModel,
    private readonly deps?: InMemoryPreOrderListQueryDeps,
  ) {}

  private toOrderRows(
    organizationId: OrganizationId,
    locationId: LocationId,
  ): PreOrderListCoreRow[] {
    const rows = this.readModel
      .listOrganizationSnapshots(organizationId, locationId)
      .filter((row) => row.snapshot.toOrder > 0)
      .map(
        (row): PreOrderListCoreRow =>
          Object.freeze({
            sku: row.sku,
            committed: row.snapshot.committed,
            onHand: row.snapshot.onHand,
            onOrder: row.snapshot.onOrder,
            toOrder: row.snapshot.toOrder,
          }),
      );
    rows.sort(compareRowsBySku);
    return rows;
  }

  private async filterRows(
    organizationId: OrganizationId,
    rows: readonly PreOrderListCoreRow[],
    supplierId: SupplierId | undefined,
    needsMapping: boolean | undefined,
  ): Promise<PreOrderListCoreRow[]> {
    if (supplierId === undefined && needsMapping !== true) {
      return [...rows];
    }
    const mappingPort = this.deps?.supplierMapping;
    if (mappingPort === undefined) {
      throw new Error("supplierMapping is required for filtered toOrder list queries");
    }
    const mappings = await mappingPort.getSkuMappings(
      organizationId,
      rows.map((row) => row.sku),
    );
    return rows.filter((row) => {
      const mapping = mappings.get(row.sku.value) ?? {
        status: "unmapped",
        supplierId: null,
      };
      return matchesFilter(mapping, supplierId, needsMapping);
    });
  }

  async list(query: PreOrderListQuery) {
    const organizationId = requireOrganizationId(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const rows = await this.filterRows(
      organizationId,
      this.toOrderRows(organizationId, locationId),
      query.supplierId,
      query.needsMapping,
    );
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(offset, offset + query.pageSize),
      total: rows.length,
    };
  }

  async listAll(query: Omit<PreOrderListQuery, "page" | "pageSize" | "supplierId" | "needsMapping">) {
    const organizationId = requireOrganizationId(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    return this.toOrderRows(organizationId, locationId);
  }

  async listFactories(query: PreOrderFactoryListQuery) {
    const organizationId = requireOrganizationId(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const mappingPort = this.deps?.supplierMapping;
    if (mappingPort === undefined) {
      throw new Error("supplierMapping is required for toOrder factory list queries");
    }

    const rows = this.toOrderRows(organizationId, locationId);
    const mappings = await mappingPort.getSkuMappings(
      organizationId,
      rows.map((row) => row.sku),
    );

    const bySupplier = new Map<SupplierId, { productCount: number; totalToOrderUnits: number }>();
    const supplierSkus = new Map<SupplierId, Sku[]>();
    let needsMappingProductCount = 0;
    let needsMappingUnits = 0;

    for (const row of rows) {
      const mapping = mappings.get(row.sku.value) ?? {
        status: "unmapped",
        supplierId: null,
      };
      if (mapping.status === "mapped" && mapping.supplierId !== null) {
        const existing = bySupplier.get(mapping.supplierId) ?? {
          productCount: 0,
          totalToOrderUnits: 0,
        };
        existing.productCount += 1;
        existing.totalToOrderUnits += row.toOrder;
        bySupplier.set(mapping.supplierId, existing);
        const skus = supplierSkus.get(mapping.supplierId) ?? [];
        skus.push(row.sku);
        supplierSkus.set(mapping.supplierId, skus);
        continue;
      }
      needsMappingProductCount += 1;
      needsMappingUnits += row.toOrder;
    }

    const supplierIds = [...bySupplier.keys()];
    const supplierInfo =
      this.deps?.suppliers === undefined
        ? new Map()
        : await this.deps.suppliers.findByIds(organizationId, supplierIds);
    let factoryRows: PreOrderFactoryCoreRow[] = [...bySupplier.entries()].map(
      ([supplierId, aggregate]) =>
        Object.freeze({
          supplierId,
          productCount: aggregate.productCount,
          totalToOrderUnits: aggregate.totalToOrderUnits,
          needsMapping: false,
        }),
    );
    factoryRows.sort((left, right) => {
      const leftName =
        supplierInfo.get(left.supplierId!)?.supplierName ?? left.supplierId!;
      const rightName =
        supplierInfo.get(right.supplierId!)?.supplierName ?? right.supplierId!;
      return leftName.localeCompare(rightName);
    });

    if (needsMappingProductCount > 0) {
      factoryRows.push(
        Object.freeze({
          supplierId: null,
          productCount: needsMappingProductCount,
          totalToOrderUnits: needsMappingUnits,
          needsMapping: true,
        }),
      );
    }

    if (query.excludeSuppliersWithOpenDraft === true && supplierSkus.size > 0) {
      const draftPort = this.deps?.openDraftPurchaseOrders;
      if (draftPort === undefined) {
        throw new Error(
          "openDraftPurchaseOrders is required when excludeSuppliersWithOpenDraft is true",
        );
      }
      const draftLookupRows = [...supplierSkus.entries()].flatMap(([supplierId, skus]) =>
        skus.map((sku) => ({ supplierId, sku })),
      );
      const openDrafts = await draftPort.findOpenDraftsForSupplierSkus(
        organizationId,
        draftLookupRows,
      );
      const suppliersWithOpenDraft = new Set<SupplierId>();
      for (const [supplierId, skus] of supplierSkus) {
        for (const sku of skus) {
          if (openDrafts.has(preOrderSkuDraftKey(supplierId, sku))) {
            suppliersWithOpenDraft.add(supplierId);
            break;
          }
        }
      }
      factoryRows = factoryRows.filter(
        (row) =>
          row.needsMapping ||
          row.supplierId === null ||
          !suppliersWithOpenDraft.has(row.supplierId),
      );
    }

    const offset = (query.page - 1) * query.pageSize;
    return {
      items: factoryRows.slice(offset, offset + query.pageSize),
      total: factoryRows.length,
    };
  }
}
