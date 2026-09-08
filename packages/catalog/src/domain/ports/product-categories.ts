import type { OrganizationId, ProductId } from "@dc-inventory/shared-kernel";

export type ProductCategoryAssignment = {
  readonly productId: ProductId;
  readonly categoryNames: readonly string[];
};

export interface IProductCategoryRepository {
  listNamesForProduct(
    organizationId: OrganizationId,
    productId: ProductId,
  ): Promise<readonly string[]>;
  replaceForProducts(
    organizationId: OrganizationId,
    assignments: readonly ProductCategoryAssignment[],
  ): Promise<void>;
}
