import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export type ProductPrimarySupplierTerms = {
  readonly vendorNumber: string | null;
  readonly vendorName: string | null;
  readonly supplierSku: string | null;
  readonly minOrderQty: number | null;
  readonly minOrderAmountCents: number | null;
  readonly lastPoCostCents: number | null;
};

/** Primary vendor link from Product Browser import (`vendor_num` / `vendor` row). */
export interface IProductPrimarySupplierReadPort {
  findByCatalogSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductPrimarySupplierTerms | null>;
}
