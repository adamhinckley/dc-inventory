import type {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";

export type UncoveredSkuMappingStatus = "mapped" | "unmapped" | "ambiguous";

export type UncoveredSkuSupplierMapping = Readonly<{
  status: UncoveredSkuMappingStatus;
  supplierId: SupplierId | null;
}>;

export type UncoveredSkuSupplierInfo = Readonly<{
  supplierId: SupplierId;
  supplierNumber: string;
  supplierName: string;
}>;

export type UncoveredSkuDraftPurchaseOrderRef = Readonly<{
  id: PurchaseOrderId;
  documentNumber: string;
}>;

export type UncoveredSkuSupplierSku = Readonly<{
  supplierId: SupplierId;
  sku: Sku;
}>;

export interface IUncoveredSkuSupplierMappingReadPort {
  getSkuMappings(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, UncoveredSkuSupplierMapping>>;
}

export interface IUncoveredSkuSupplierReadPort {
  findByIds(
    organizationId: OrganizationId,
    supplierIds: readonly SupplierId[],
  ): Promise<ReadonlyMap<string, UncoveredSkuSupplierInfo>>;
}

export interface IUncoveredSkuDraftPurchaseOrderReadPort {
  findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly UncoveredSkuSupplierSku[],
  ): Promise<ReadonlyMap<string, UncoveredSkuDraftPurchaseOrderRef>>;
}

export function uncoveredSkuDraftKey(supplierId: SupplierId, sku: Sku): string {
  return `${supplierId}:${sku.value}`;
}
