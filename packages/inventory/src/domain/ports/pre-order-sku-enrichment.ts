import type {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";

export type PreOrderSkuMappingStatus = "mapped" | "unmapped" | "ambiguous";

export type PreOrderSkuSupplierMapping = Readonly<{
  status: PreOrderSkuMappingStatus;
  supplierId: SupplierId | null;
}>;

export type PreOrderSkuSupplierInfo = Readonly<{
  supplierId: SupplierId;
  supplierNumber: string;
  supplierName: string;
  poPrefix: string | null;
}>;

export type PreOrderSkuDraftPurchaseOrderRef = Readonly<{
  id: PurchaseOrderId;
  documentNumber: string;
}>;

export type PreOrderSkuSupplierSku = Readonly<{
  supplierId: SupplierId;
  sku: Sku;
}>;

export interface IPreOrderSkuSupplierMappingReadPort {
  getSkuMappings(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, PreOrderSkuSupplierMapping>>;
}

export interface IPreOrderSkuSupplierReadPort {
  findByIds(
    organizationId: OrganizationId,
    supplierIds: readonly SupplierId[],
  ): Promise<ReadonlyMap<string, PreOrderSkuSupplierInfo>>;
}

export interface IPreOrderSkuDraftPurchaseOrderReadPort {
  findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly PreOrderSkuSupplierSku[],
  ): Promise<ReadonlyMap<string, PreOrderSkuDraftPurchaseOrderRef>>;
}

export function preOrderSkuDraftKey(supplierId: SupplierId, sku: Sku): string {
  return `${supplierId}:${sku.value}`;
}
