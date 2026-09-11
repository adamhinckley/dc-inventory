import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { PurchaseOrderId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { PreOrderSkuMappingStatus } from "./pre-order-sku-enrichment.js";

export type PreOrderListQuery = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
  supplierId?: SupplierId;
  needsMapping?: boolean;
};

export type PreOrderFactoryListQuery = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
  excludeSuppliersWithOpenDraft?: boolean;
};

export type PreOrderFactoryCoreRow = Readonly<{
  supplierId: SupplierId | null;
  productCount: number;
  totalToOrderUnits: number;
  needsMapping: boolean;
}>;

export type PreOrderFactoryListPage = {
  items: readonly PreOrderFactoryCoreRow[];
  total: number;
};

export type PreOrderListCoreRow = Readonly<{
  sku: Sku;
  committed: number;
  onHand: number;
  onOrder: number;
  toOrder: number;
}>;

export type PreOrderSkuDraftPurchaseOrderRef = Readonly<{
  id: PurchaseOrderId;
  documentNumber: string;
}>;

export type PreOrderListRow = Readonly<{
  sku: Sku;
  committed: number;
  onHand: number;
  onOrder: number;
  toOrder: number;
  caseQty: number | null;
  reorderMin: number | null;
  reorderMax: number | null;
  supplierId: SupplierId | null;
  supplierNumber: string | null;
  supplierName: string | null;
  mappingStatus: PreOrderSkuMappingStatus;
  draftPurchaseOrder: PreOrderSkuDraftPurchaseOrderRef | null;
}>;

export type PreOrderListPage = {
  items: readonly PreOrderListCoreRow[];
  total: number;
};

/**
 * Paged read boundary for SKUs with factory to-order need
 * (`toOrder = max(0, committed − on_hand − on_order)`).
 */
export interface IPreOrderListQuery {
  list(query: PreOrderListQuery): Promise<PreOrderListPage>;
  listAll(
    query: Omit<PreOrderListQuery, "page" | "pageSize" | "supplierId" | "needsMapping">,
  ): Promise<readonly PreOrderListCoreRow[]>;
  listFactories(query: PreOrderFactoryListQuery): Promise<PreOrderFactoryListPage>;
}
