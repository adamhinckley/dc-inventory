import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type {
  IPurchaseOrderRepository,
  ListPurchaseOrdersQuery,
} from "../domain/ports/purchase-order-repository.js";

export type ListPurchaseOrdersRequest = ListPurchaseOrdersQuery & {
  staffUserId: StaffUserId;
};

export class ListPurchaseOrdersUseCase {
  constructor(private readonly purchaseOrders: IPurchaseOrderRepository) {}

  async execute(input: ListPurchaseOrdersRequest) {
    void input.staffUserId;
    const page = await this.purchaseOrders.list({
      organizationId: input.organizationId,
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      status: input.status,
      supplierId: input.supplierId,
    });
    return {
      items: page.items,
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
