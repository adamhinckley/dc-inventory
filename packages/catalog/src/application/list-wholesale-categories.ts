import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IProductRepository } from "../domain/ports/product-repository.js";

export type ListWholesaleCategoriesRequest = {
  organizationId: OrganizationId;
  customerId: CustomerId;
};

export type ListWholesaleCategoriesResult = {
  items: string[];
};

/** Shop navigation: only categories a buyer can actually browse into. */
export class ListWholesaleCategoriesUseCase {
  constructor(private readonly products: IProductRepository) {}

  async execute(
    input: ListWholesaleCategoriesRequest,
  ): Promise<ListWholesaleCategoriesResult> {
    void input.customerId;
    return {
      items: await this.products.listCategoryNames(input.organizationId, {
        shopVisibleOnly: true,
      }),
    };
  }
}
