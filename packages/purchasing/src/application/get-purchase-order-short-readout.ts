import { OrganizationId, PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type {
  CommittedCustomerName,
  ICommittedCustomerNamesPort,
  IInventoryUncoveredReadPort,
} from "../domain/ports/short-readout.js";

export type GetPurchaseOrderShortReadoutRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
};

export type PurchaseOrderShortReadoutUncoveredRow = Readonly<{
  sku: string;
  uncovered: number;
}>;

export type PurchaseOrderShortReadoutAffectedCustomer = Readonly<{
  customerId: string;
  name: string;
}>;

export type GetPurchaseOrderShortReadoutResult =
  | {
      ok: true;
      uncovered: readonly PurchaseOrderShortReadoutUncoveredRow[];
      affectedCustomers: readonly PurchaseOrderShortReadoutAffectedCustomer[];
    }
  | { ok: false; reason: "not_found" };

export class GetPurchaseOrderShortReadoutUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly inventoryUncovered: IInventoryUncoveredReadPort,
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

    const uncoveredBySku = await this.inventoryUncovered.getUncoveredBySkus(
      input.organizationId,
      purchaseOrder.lines.map((line) => line.sku),
    );
    const uncoveredRows = purchaseOrder.lines.map((line) => ({
      sku: line.sku,
      uncovered: uncoveredBySku.get(line.sku.value) ?? 0,
    }));

    const skusWithUncovered = uncoveredRows
      .filter((row) => row.uncovered > 0)
      .map((row) => row.sku);

    let affectedCustomers: readonly CommittedCustomerName[] = [];
    if (skusWithUncovered.length > 0) {
      affectedCustomers = await this.committedCustomers.listCommittedCustomerNames(
        input.organizationId,
        skusWithUncovered,
      );
    }

    return {
      ok: true,
      uncovered: uncoveredRows.map((row) => ({
        sku: row.sku.value,
        uncovered: row.uncovered,
      })),
      affectedCustomers: affectedCustomers.map((customer) => ({
        customerId: customer.customerId,
        name: customer.name,
      })),
    };
  }
}
