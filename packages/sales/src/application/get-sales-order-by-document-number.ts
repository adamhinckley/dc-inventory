import { OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { ISalesOrderRepository } from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";

export type GetSalesOrderByDocumentNumberRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  documentNumber: string;
};

export type GetSalesOrderByDocumentNumberResult =
  | { ok: true; salesOrder: SalesOrder }
  | { ok: false; reason: "not_found" };

export class GetSalesOrderByDocumentNumberUseCase {
  constructor(private readonly salesOrders: ISalesOrderRepository) {}

  async execute(
    input: GetSalesOrderByDocumentNumberRequest,
  ): Promise<GetSalesOrderByDocumentNumberResult> {
    void input.staffUserId;
    const salesOrder = await this.salesOrders.findByDocumentNumber(
      input.organizationId,
      input.documentNumber,
    );
    if (salesOrder === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, salesOrder };
  }
}
