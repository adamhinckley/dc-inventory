import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export type ProductReorderPolicy = {
  readonly reorderMin: number | null;
  readonly reorderMax: number | null;
};

export interface IProductReorderReadPort {
  findByCatalogSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductReorderPolicy | null>;
}
