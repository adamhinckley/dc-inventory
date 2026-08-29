import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type {
  ISalesOrderRepository,
  ListSalesOrdersQuery,
} from "../domain/ports/sales-order-repository.js";

export type ListSalesOrdersRequest = ListSalesOrdersQuery & {
  staffUserId: StaffUserId;
};

export class ListSalesOrdersUseCase {
  constructor(private readonly salesOrders: ISalesOrderRepository) {}

  async execute(input: ListSalesOrdersRequest) {
    void input.staffUserId;
    const page = await this.salesOrders.list({
      organizationId: input.organizationId,
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      status: input.status,
      customerId: input.customerId,
    });
    return {
      items: page.items,
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
