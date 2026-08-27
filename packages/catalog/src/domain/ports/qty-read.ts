import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { ProductQty } from "../qty.js";

/**
 * Catalog-owned qty read port. SKU in; on-hand / on-order / allocated /
 * available out. Missing snapshot is omitted — callers treat that as 0.
 * Catalog never writes qty through this port.
 */
export interface IQtyReadPort {
  readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, ProductQty>>;
}
