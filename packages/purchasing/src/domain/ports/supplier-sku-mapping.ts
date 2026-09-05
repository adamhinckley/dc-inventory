import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";

/** Resolves the factory supplier for a catalog SKU within an organization. */
export interface ISupplierSkuMappingReadPort {
  findSupplierForSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierId | null>;
}
