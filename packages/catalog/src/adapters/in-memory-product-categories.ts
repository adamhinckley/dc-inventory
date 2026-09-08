import type { OrganizationId, ProductId } from "@dc-inventory/shared-kernel";
import type {
  IProductCategoryRepository,
  ProductCategoryAssignment,
} from "../domain/ports/product-categories.js";
import type { InMemoryProductRepository } from "./in-memory-product-repository.js";

export class InMemoryProductCategoryRepository implements IProductCategoryRepository {
  constructor(private readonly products: InMemoryProductRepository) {}

  async listNamesForProduct(
    _organizationId: OrganizationId,
    productId: ProductId,
  ): Promise<readonly string[]> {
    return this.products.getCategoryNames(productId);
  }

  async replaceForProducts(
    _organizationId: OrganizationId,
    assignments: readonly ProductCategoryAssignment[],
  ): Promise<void> {
    for (const assignment of assignments) {
      this.products.setCategories(assignment.productId, assignment.categoryNames);
    }
  }
}
