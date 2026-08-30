import { OrganizationId, PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IFactorySendCatalogPort } from "../domain/ports/factory-send-catalog.js";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { ISupplierProductRepository } from "../domain/ports/supplier-product-repository.js";
import {
  FACTORY_PO_COLUMNS,
  factorySendJsonRow,
  loadFactorySendSheet,
  type FactorySendJsonRow,
} from "./export-purchase-order.js";

export type GetPurchaseOrderFactorySendRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
};

export type GetPurchaseOrderFactorySendResult =
  | {
      ok: true;
      columns: readonly { key: string; header: string }[];
      rows: readonly FactorySendJsonRow[];
    }
  | { ok: false; reason: "not_found" };

export class GetPurchaseOrderFactorySendUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly supplierProducts: ISupplierProductRepository,
    private readonly factorySendCatalog: IFactorySendCatalogPort,
  ) {}

  async execute(
    input: GetPurchaseOrderFactorySendRequest,
  ): Promise<GetPurchaseOrderFactorySendResult> {
    void input.staffUserId;
    const purchaseOrder = await this.purchaseOrders.findById(
      input.organizationId,
      input.purchaseOrderId,
    );
    if (purchaseOrder === null) {
      return { ok: false, reason: "not_found" };
    }

    const sheet = await loadFactorySendSheet(
      purchaseOrder,
      this.supplierProducts,
      this.factorySendCatalog,
    );
    return {
      ok: true,
      columns: FACTORY_PO_COLUMNS.map((column) => ({
        key: column.key,
        header: column.header,
      })),
      rows: sheet.rows.map((row, index) =>
        factorySendJsonRow(row, sheet.blocksTotCartons[index] === true),
      ),
    };
  }
}
