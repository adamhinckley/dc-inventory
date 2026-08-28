import { OrganizationId, PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type {
  IWorkbookWriter,
  WorkbookFormat,
  WorkbookWriteResult,
} from "../domain/ports/workbook-writer.js";

const PO_LINE_COLUMNS = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Name" },
  { key: "qty", header: "Qty" },
  { key: "receivedQty", header: "Received Qty" },
] as const;

export type ExportPurchaseOrderRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  format: WorkbookFormat;
};

export type ExportPurchaseOrderResult =
  | { ok: true; file: WorkbookWriteResult }
  | { ok: false; reason: "not_found" };

export class ExportPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly workbookWriter: IWorkbookWriter,
  ) {}

  async execute(input: ExportPurchaseOrderRequest): Promise<ExportPurchaseOrderResult> {
    void input.staffUserId;
    const purchaseOrder = await this.purchaseOrders.findById(
      input.organizationId,
      input.purchaseOrderId,
    );
    if (purchaseOrder === null) {
      return { ok: false, reason: "not_found" };
    }

    const rows = purchaseOrder.lines.map((line) => ({
      sku: line.sku.value,
      name: line.name,
      qty: line.qty,
      receivedQty: line.receivedQty,
    }));

    const file = await this.workbookWriter.write({
      sheetName: purchaseOrder.documentNumber,
      columns: PO_LINE_COLUMNS,
      rows,
      format: input.format,
    });

    return { ok: true, file };
  }
}
