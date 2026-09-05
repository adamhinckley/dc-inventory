import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { IProductRepository } from "../domain/ports/product-repository.js";

export type ListStaffCategoriesRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
};

export type ListStaffCategoriesResult = {
  items: string[];
};

export class ListStaffCategoriesUseCase {
  constructor(private readonly products: IProductRepository) {}

  async execute(input: ListStaffCategoriesRequest): Promise<ListStaffCategoriesResult> {
    void input.staffUserId;
    return {
      items: await this.products.listCategoryNames(input.organizationId),
    };
  }
}
