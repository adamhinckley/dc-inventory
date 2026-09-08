import type { ProductId } from "@dc-inventory/shared-kernel";
import type {
  IProductIdentifierRepository,
  ProductIdentifier,
  ProductIdentifierAssignment,
} from "../domain/ports/product-identifiers.js";

export class InMemoryProductIdentifierRepository implements IProductIdentifierRepository {
  readonly byProductId = new Map<ProductId, ProductIdentifier[]>();

  async findByProductId(productId: ProductId): Promise<readonly ProductIdentifier[]> {
    return this.byProductId.get(productId) ?? [];
  }

  async replaceForProducts(assignments: readonly ProductIdentifierAssignment[]): Promise<void> {
    for (const assignment of assignments) {
      this.byProductId.set(assignment.productId, [...assignment.identifiers]);
    }
  }
}
