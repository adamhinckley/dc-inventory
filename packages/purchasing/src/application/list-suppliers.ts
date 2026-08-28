import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { Supplier } from "../domain/supplier.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";

export type ListSuppliersRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  q?: string;
  page: number;
  pageSize: number;
};

export type ListSuppliersResult = {
  items: Supplier[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListSuppliersUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  async execute(input: ListSuppliersRequest): Promise<ListSuppliersResult> {
    void input.staffUserId;
    const page = await this.suppliers.list({
      organizationId: input.organizationId,
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
    });
    return {
      items: [...page.items],
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
