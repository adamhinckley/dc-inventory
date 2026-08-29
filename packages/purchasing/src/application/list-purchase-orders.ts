import type { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import type {
  IPurchaseOrderRepository,
  ISupplierRepository,
  ListPurchaseOrdersQuery,
} from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";

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
      organizationId: input.organizationId,
      page: input.page,
      pageSize: input.pageSize,
      status: input.status,
      supplierId: input.supplierId,
    });
    return {
      items: page.items,
      supplierNames: await supplierNamesById(
        this.suppliers,
        input.organizationId,
        page.items,
      ),
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}

async function supplierNamesById(
  suppliers: ISupplierRepository,
  organizationId: OrganizationId,
  orders: readonly PurchaseOrder[],
): Promise<ReadonlyMap<string, string>> {
  const uniqueIds = [...new Set(orders.map((order) => order.supplierId))];
  const names = new Map<string, string>();
  await Promise.all(
    uniqueIds.map(async (supplierId: SupplierId) => {
      const supplier = await suppliers.findById(organizationId, supplierId);
      names.set(supplierId, supplier?.name ?? "");
    }),
  );
  return names;
}
