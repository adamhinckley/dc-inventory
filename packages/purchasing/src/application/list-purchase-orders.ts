import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type {
  IPurchaseOrderRepository,
  ISupplierRepository,
  ListPurchaseOrdersQuery,
} from "../domain/ports/purchase-order-repository.js";
import { labelsForSupplier } from "./purchase-order-supplier-labels.js";

export type ListPurchaseOrdersRequest = ListPurchaseOrdersQuery & {
  staffUserId: StaffUserId;
};

export class ListPurchaseOrdersUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly suppliers: ISupplierRepository,
  ) {}

  async execute(input: ListPurchaseOrdersRequest) {
    void input.staffUserId;
    const page = await this.purchaseOrders.list({
      page: input.page,
      pageSize: input.pageSize,
      status: input.status,
      supplierId: input.supplierId,
    });
    const items = [];
    for (const purchaseOrder of page.items) {
      items.push({
        purchaseOrder,
        ...(await labelsForSupplier(this.suppliers, purchaseOrder.supplierId)),
      });
    }
    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}

