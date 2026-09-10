import {
  LocationId,
  requireOrganizationId,
  type OrganizationId,
  type Sku,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import type {
  IUncoveredListQuery,
  UncoveredFactoryCoreRow,
  UncoveredFactoryListQuery,
  UncoveredListCoreRow,
  UncoveredListQuery,
} from "../domain/ports/uncovered-list-query.js";
import type {
  IUncoveredSkuDraftPurchaseOrderReadPort,
  IUncoveredSkuSupplierMappingReadPort,
  IUncoveredSkuSupplierReadPort,
  UncoveredSkuSupplierMapping,
} from "../domain/ports/uncovered-sku-enrichment.js";
import { uncoveredSkuDraftKey } from "../domain/ports/uncovered-sku-enrichment.js";
import type { InMemoryInventoryReadModel } from "./in-memory-inventory-read-model.js";

function compareRowsBySku(a: UncoveredListCoreRow, b: UncoveredListCoreRow): number {
  return a.sku.value.localeCompare(b.sku.value);
}

function matchesFilter(
  mapping: UncoveredSkuSupplierMapping,
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

export type InMemoryUncoveredListQueryDeps = Readonly<{
  supplierMapping: IUncoveredSkuSupplierMappingReadPort;
  suppliers?: IUncoveredSkuSupplierReadPort;
  openDraftPurchaseOrders?: IUncoveredSkuDraftPurchaseOrderReadPort;
}>;

export class InMemoryUncoveredListQuery implements IUncoveredListQuery {
  constructor(
    private readonly readModel: InMemoryInventoryReadModel,
    private readonly deps?: InMemoryUncoveredListQueryDeps,
  ) {}

  private uncoveredRows(
    organizationId: OrganizationId,
    locationId: LocationId,
  ): UncoveredListCoreRow[] {
    const rows = this.readModel
      .listOrganizationSnapshots(organizationId, locationId)
      .filter((row) => row.snapshot.uncovered > 0)
      .map(
        (row): UncoveredListCoreRow =>
          Object.freeze({
            sku: row.sku,
            committed: row.snapshot.committed,
            onHand: row.snapshot.onHand,
            onOrder: row.snapshot.onOrder,
            uncovered: row.snapshot.uncovered,
          }),
      );
    rows.sort(compareRowsBySku);
    return rows;
  }

  private async filterRows(
    organizationId: OrganizationId,
    rows: readonly UncoveredListCoreRow[],
    supplierId: SupplierId | undefined,
    needsMapping: boolean | undefined,
  ): Promise<UncoveredListCoreRow[]> {
    if (supplierId === undefined && needsMapping !== true) {
      return [...rows];
    }
    const mappingPort = this.deps?.supplierMapping;
    if (mappingPort === undefined) {
      throw new Error("supplierMapping is required for filtered uncovered list queries");
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

  async list(query: UncoveredListQuery) {
    const organizationId = requireOrganizationId(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const rows = await this.filterRows(
      organizationId,
      this.uncoveredRows(organizationId, locationId),
      query.supplierId,
      query.needsMapping,
    );
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(offset, offset + query.pageSize),
      total: rows.length,
    };
  }

  async listAll(query: Omit<UncoveredListQuery, "page" | "pageSize" | "supplierId" | "needsMapping">) {
    const organizationId = requireOrganizationId(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    return this.uncoveredRows(organizationId, locationId);
  }

  async listFactories(query: UncoveredFactoryListQuery) {
    const organizationId = requireOrganizationId(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const mappingPort = this.deps?.supplierMapping;
    if (mappingPort === undefined) {
      throw new Error("supplierMapping is required for uncovered factory list queries");
    }

    const rows = this.uncoveredRows(organizationId, locationId);
    const mappings = await mappingPort.getSkuMappings(
      organizationId,
      rows.map((row) => row.sku),
    );

    const bySupplier = new Map<SupplierId, { productCount: number; totalUncoveredUnits: number }>();
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
          totalUncoveredUnits: 0,
        };
        existing.productCount += 1;
        existing.totalUncoveredUnits += row.uncovered;
        bySupplier.set(mapping.supplierId, existing);
        const skus = supplierSkus.get(mapping.supplierId) ?? [];
        skus.push(row.sku);
        supplierSkus.set(mapping.supplierId, skus);
        continue;
      }
      needsMappingProductCount += 1;
      needsMappingUnits += row.uncovered;
    }

    const supplierIds = [...bySupplier.keys()];
    const supplierInfo =
      this.deps?.suppliers === undefined
        ? new Map()
        : await this.deps.suppliers.findByIds(organizationId, supplierIds);
    let factoryRows: UncoveredFactoryCoreRow[] = [...bySupplier.entries()].map(
      ([supplierId, aggregate]) =>
        Object.freeze({
          supplierId,
          productCount: aggregate.productCount,
          totalUncoveredUnits: aggregate.totalUncoveredUnits,
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
          totalUncoveredUnits: needsMappingUnits,
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
          if (openDrafts.has(uncoveredSkuDraftKey(supplierId, sku))) {
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
