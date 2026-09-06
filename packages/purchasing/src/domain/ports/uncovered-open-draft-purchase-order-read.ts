import type {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";

export type UncoveredOpenDraftPurchaseOrderRef = Readonly<{
  id: PurchaseOrderId;
  documentNumber: string;
}>;

export type UncoveredOpenDraftSupplierSku = Readonly<{
  supplierId: SupplierId;
  sku: Sku;
}>;

export interface IUncoveredOpenDraftPurchaseOrderReadPort {
  findOpenDraftForSupplierSku(
    organizationId: OrganizationId,
    supplierId: SupplierId,
    sku: Sku,
  ): Promise<UncoveredOpenDraftPurchaseOrderRef | null>;

  findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly UncoveredOpenDraftSupplierSku[],
  ): Promise<ReadonlyMap<string, UncoveredOpenDraftPurchaseOrderRef>>;
}

export function uncoveredOpenDraftKey(supplierId: SupplierId, sku: Sku): string {
  return `${supplierId}:${sku.value}`;
}
