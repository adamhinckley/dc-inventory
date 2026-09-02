import { LocationId } from "@dc-inventory/shared-kernel";
import type { OrganizationId, PurchaseOrderId, Sku } from "@dc-inventory/shared-kernel";
import type { IInventoryReadModel } from "../domain/ports/stock-ledger.js";
import type { IPurchaseOrderLookup } from "../domain/ports/purchase-order-lookup.js";

export type ListPurchaseOrderGoodsReceivedRequest = {
  organizationId: OrganizationId;
  purchaseOrderId: PurchaseOrderId;
};

export type PurchaseOrderGoodsReceivedItem = {
  createdAt: Date;
  sku: Sku;
  quantity: number;
};

export type ListPurchaseOrderGoodsReceivedResult =
  | { ok: true; items: readonly PurchaseOrderGoodsReceivedItem[] }
  | { ok: false; reason: "not_found" };

export class ListPurchaseOrderGoodsReceivedUseCase {
  constructor(
    private readonly readModel: IInventoryReadModel,
    private readonly purchaseOrders: IPurchaseOrderLookup,
  ) {}

  async execute(
    input: ListPurchaseOrderGoodsReceivedRequest,
  ): Promise<ListPurchaseOrderGoodsReceivedResult> {
    const exists = await this.purchaseOrders.exists(
      input.organizationId,
      input.purchaseOrderId,
    );
    if (!exists) {
      return { ok: false, reason: "not_found" };
    }

    const movements = await this.readModel.listMovements({
      organizationId: input.organizationId,
      locationId: LocationId.DEFAULT,
    });

    const items = movements
      .filter(
        (movement) =>
          movement.movementType === "GoodsReceived" &&
          movement.refType === "purchase_order" &&
          movement.refId === input.purchaseOrderId,
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((movement) => ({
        createdAt: movement.createdAt,
        sku: movement.sku,
        quantity: movement.quantity,
      }));

    return { ok: true, items };
  }
}
