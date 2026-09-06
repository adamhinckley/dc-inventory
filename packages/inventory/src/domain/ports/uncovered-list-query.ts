import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { PurchaseOrderId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { UncoveredSkuMappingStatus } from "./uncovered-sku-enrichment.js";

export type UncoveredListQuery = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
};

export type UncoveredListCoreRow = Readonly<{
  sku: Sku;
  committed: number;
  onHand: number;
  onOrder: number;
  uncovered: number;
}>;

export type UncoveredSkuDraftPurchaseOrderRef = Readonly<{
  id: PurchaseOrderId;
  documentNumber: string;
}>;

export type UncoveredListRow = Readonly<{
  sku: Sku;
  committed: number;
  onHand: number;
  onOrder: number;
  uncovered: number;
  caseQty: number | null;
  reorderMin: number | null;
  reorderMax: number | null;
  supplierId: SupplierId | null;
  supplierNumber: string | null;
  supplierName: string | null;
  mappingStatus: UncoveredSkuMappingStatus;
  draftPurchaseOrder: UncoveredSkuDraftPurchaseOrderRef | null;
}>;

export type UncoveredListPage = {
  items: readonly UncoveredListCoreRow[];
  total: number;
};

/**
 * Paged read boundary for SKUs with factory to-order need
 * (`uncovered = max(0, committed − on_hand − on_order)`).
 */
export interface IUncoveredListQuery {
  list(query: UncoveredListQuery): Promise<UncoveredListPage>;
  listAll(query: Omit<UncoveredListQuery, "page" | "pageSize">): Promise<readonly UncoveredListCoreRow[]>;
}
