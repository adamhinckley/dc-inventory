import { OrganizationId, PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type {
  CommittedCustomerName,
  ICommittedCustomerNamesPort,
  IInventoryToOrderReadPort,
} from "../domain/ports/short-readout.js";

export type GetPurchaseOrderShortReadoutRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
};

export type PurchaseOrderShortReadoutToOrderRow = Readonly<{
  sku: string;
  toOrder: number;
}>;

export type PurchaseOrderShortReadoutAffectedCustomer = Readonly<{
  customerId: string;
  name: string;
}>;

export type GetPurchaseOrderShortReadoutResult =
  | {
      ok: true;
      toOrder: readonly PurchaseOrderShortReadoutToOrderRow[];
      affectedCustomers: readonly PurchaseOrderShortReadoutAffectedCustomer[];
    }
  | { ok: false; reason: "not_found" };

export class GetPurchaseOrderShortReadoutUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly inventoryToOrder: IInventoryToOrderReadPort,
    private readonly committedCustomers: ICommittedCustomerNamesPort,
  ) {}

  async execute(
    input: GetPurchaseOrderShortReadoutRequest,
  ): Promise<GetPurchaseOrderShortReadoutResult> {
    void input.staffUserId;
    const purchaseOrder = await this.purchaseOrders.findById(
      input.organizationId,
      input.purchaseOrderId,
    );
    if (purchaseOrder === null) {
      return { ok: false, reason: "not_found" };
    }

    const toOrderBySku = await this.inventoryToOrder.getToOrderBySkus(
      input.organizationId,
      purchaseOrder.lines.map((line) => line.sku),
    );
    const toOrderRows = purchaseOrder.lines.map((line) => ({
      sku: line.sku,
      toOrder: toOrderBySku.get(line.sku.value) ?? 0,
    }));

    const skusWithToOrder = toOrderRows
      .filter((row) => row.toOrder > 0)
      .map((row) => row.sku);

    let affectedCustomers: readonly CommittedCustomerName[] = [];
    if (skusWithToOrder.length > 0) {
      affectedCustomers = await this.committedCustomers.listCommittedCustomerNames(
        input.organizationId,
        skusWithToOrder,
      );
    }

    return {
      ok: true,
      toOrder: toOrderRows.map((row) => ({
        sku: row.sku.value,
        toOrder: row.toOrder,
      })),
      affectedCustomers: affectedCustomers.map((customer) => ({
        customerId: customer.customerId,
        name: customer.name,
      })),
    };
  }
}
