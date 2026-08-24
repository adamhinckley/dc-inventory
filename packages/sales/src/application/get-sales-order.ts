import { OrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { ISalesOrderRepository } from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";

export type GetSalesOrderRequest = {
  staffUserId: StaffUserId;
  salesOrderId: OrderId;
};

export type GetSalesOrderResult =
  | { ok: true; salesOrder: SalesOrder }
  | { ok: false; reason: "not_found" };

export class GetSalesOrderUseCase {
  constructor(private readonly salesOrders: ISalesOrderRepository) {}

  async execute(input: GetSalesOrderRequest): Promise<GetSalesOrderResult> {
    void input.staffUserId;
    const salesOrder = await this.salesOrders.findById(input.salesOrderId);
    if (salesOrder === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, salesOrder };
  }
}
