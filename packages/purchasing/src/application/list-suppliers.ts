import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";

export type ListSuppliersRequest = {
  staffUserId: StaffUserId;
};

export class ListSuppliersUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  async execute(input: ListSuppliersRequest) {
    void input.staffUserId;
    return { items: await this.suppliers.list() };
  }
}
