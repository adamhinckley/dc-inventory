import {
  LocationId,
  OrganizationId,
  requireOrganizationId,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import type { IPreOrderListQuery } from "../domain/ports/pre-order-list-query.js";
import type { IPreOrderSkuSupplierReadPort } from "../domain/ports/pre-order-sku-enrichment.js";

export const PRE_ORDER_NEEDS_MAPPING_FACTORY_ROW_ID = "needs-mapping";

export type PreOrderFactorySummaryRow = Readonly<{
  id: string;
  supplierId: SupplierId | null;
  supplierNumber: string | null;
  supplierName: string;
  poPrefix: string | null;
  productCount: number;
  totalToOrderUnits: number;
  needsMapping: boolean;
}>;

export type ListPreOrderFactoriesRequest = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
  excludeSuppliersWithOpenDraft?: boolean;
};

export type ListPreOrderFactoriesResult = {
  items: PreOrderFactorySummaryRow[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListPreOrderFactoriesUseCase {
  constructor(
    private readonly preOrderList: IPreOrderListQuery,
    private readonly suppliers: IPreOrderSkuSupplierReadPort,
  ) {}

  async execute(input: ListPreOrderFactoriesRequest): Promise<ListPreOrderFactoriesResult> {
    const organizationId = requireOrganizationId(input.organizationId);
    const resolvedLocationId = input.locationId ?? LocationId.DEFAULT;

    const page = await this.preOrderList.listFactories({
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
            id: PRE_ORDER_NEEDS_MAPPING_FACTORY_ROW_ID,
            supplierId: null,
            supplierNumber: null,
            supplierName: "Needs mapping",
            poPrefix: null,
            productCount: row.productCount,
            totalToOrderUnits: row.totalToOrderUnits,
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
          totalToOrderUnits: row.totalToOrderUnits,
          needsMapping: false,
        };
      }),
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
