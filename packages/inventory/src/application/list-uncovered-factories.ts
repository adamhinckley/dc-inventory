import {
  LocationId,
  OrganizationId,
  requireOrganizationId,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import type { IUncoveredListQuery } from "../domain/ports/uncovered-list-query.js";
import type { IUncoveredSkuSupplierReadPort } from "../domain/ports/uncovered-sku-enrichment.js";

export const UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID = "needs-mapping";

export type UncoveredFactorySummaryRow = Readonly<{
  id: string;
  supplierId: SupplierId | null;
  supplierNumber: string | null;
  supplierName: string;
  poPrefix: string | null;
  productCount: number;
  totalUncoveredUnits: number;
  needsMapping: boolean;
}>;

export type ListUncoveredFactoriesRequest = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
  excludeSuppliersWithOpenDraft?: boolean;
};

export type ListUncoveredFactoriesResult = {
  items: UncoveredFactorySummaryRow[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListUncoveredFactoriesUseCase {
  constructor(
    private readonly uncoveredList: IUncoveredListQuery,
    private readonly suppliers: IUncoveredSkuSupplierReadPort,
  ) {}

  async execute(input: ListUncoveredFactoriesRequest): Promise<ListUncoveredFactoriesResult> {
    const organizationId = requireOrganizationId(input.organizationId);
    const resolvedLocationId = input.locationId ?? LocationId.DEFAULT;

    const page = await this.uncoveredList.listFactories({
      organizationId,
      locationId: resolvedLocationId,
      page: input.page,
      pageSize: input.pageSize,
      excludeSuppliersWithOpenDraft: input.excludeSuppliersWithOpenDraft,
    });

    const mappedSupplierIds = page.items
      .map((row) => row.supplierId)
      .filter((supplierId): supplierId is SupplierId => supplierId !== null);
    const supplierInfo = await this.suppliers.findByIds(organizationId, mappedSupplierIds);

    return {
      items: page.items.map((row) => {
        if (row.needsMapping) {
          return {
            id: UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
            supplierId: null,
            supplierNumber: null,
            supplierName: "Needs mapping",
            poPrefix: null,
            productCount: row.productCount,
            totalUncoveredUnits: row.totalUncoveredUnits,
            needsMapping: true,
          };
        }
        const supplier = row.supplierId === null ? undefined : supplierInfo.get(row.supplierId);
        return {
          id: row.supplierId!,
          supplierId: row.supplierId,
          supplierNumber: supplier?.supplierNumber ?? null,
          supplierName: supplier?.supplierName ?? "Unknown factory",
          poPrefix: supplier?.poPrefix ?? null,
          productCount: row.productCount,
          totalUncoveredUnits: row.totalUncoveredUnits,
          needsMapping: false,
        };
      }),
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
