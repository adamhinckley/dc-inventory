import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { SupplierSkuMapping } from "../supplier-sku-mapping-status.js";

/** Resolves the factory supplier for a catalog SKU within an organization. */
export interface ISupplierSkuMappingReadPort {
  findSupplierForSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierId | null>;

  getSkuMapping(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierSkuMapping>;

  getSkuMappings(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, SupplierSkuMapping>>;
}
