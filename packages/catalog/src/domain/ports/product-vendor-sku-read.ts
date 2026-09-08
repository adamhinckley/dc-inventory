import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

/** Vendor item # (`mfg_code` on Product Browser import) from purchasing supplier-product links. */
export interface IProductVendorSkuReadPort {
  findVendorSkuByCatalogSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<string | null>;
}
