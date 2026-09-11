import type {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";

export type PreOrderOpenDraftPurchaseOrderRef = Readonly<{
  id: PurchaseOrderId;
  documentNumber: string;
}>;

export type PreOrderOpenDraftSupplierSku = Readonly<{
  supplierId: SupplierId;
  sku: Sku;
}>;

export interface IPreOrderOpenDraftPurchaseOrderReadPort {
  findOpenDraftForSupplierSku(
    organizationId: OrganizationId,
    supplierId: SupplierId,
    sku: Sku,
  ): Promise<PreOrderOpenDraftPurchaseOrderRef | null>;

  findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly PreOrderOpenDraftSupplierSku[],
  ): Promise<ReadonlyMap<string, PreOrderOpenDraftPurchaseOrderRef>>;
}

export function preOrderOpenDraftKey(supplierId: SupplierId, sku: Sku): string {
  return `${supplierId}:${sku.value}`;
}
