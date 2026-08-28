import { OrganizationId, PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { excelDateFromIso } from "../domain/iso-date.js";
import type { IFactorySendCatalogPort } from "../domain/ports/factory-send-catalog.js";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { ISupplierProductRepository } from "../domain/ports/supplier-product-repository.js";
import type {
  IWorkbookWriter,
  WorkbookFormat,
  WorkbookRow,
  WorkbookWriteResult,
} from "../domain/ports/workbook-writer.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";
import type { SupplierProduct } from "../domain/supplier-product.js";

/** SoloView / factory send dump. Money is decimal dollars (cents / 100). */
const FACTORY_PO_COLUMNS = [
  { key: "ship_date", header: "ship_date", numFmt: "d-mmm" },
  { key: "canc_date", header: "canc_date", numFmt: "d-mmm" },
  { key: "mat_num", header: "mat_num" },
  { key: "quan", header: "quan" },
  { key: "price", header: "price" },
  { key: "extprice", header: "extprice" },
  { key: "description", header: "description" },
  { key: "mfg_code", header: "mfg_code" },
  { key: "mfg_sku", header: "mfg_sku" },
  { key: "mfg_upc", header: "mfg_upc" },
  { key: "product_upc_1", header: "product_upc_1" },
  { key: "cs_cube_metric", header: "cs_cube_metric" },
  { key: "tot_cartons", header: "tot_cartons" },
  { key: "tot_cbm", header: "tot_cbm" },
] as const;

const EMPTY = "";
const CUBE_UNAVAILABLE = "Not Available";

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
    private readonly supplierProducts: ISupplierProductRepository,
    private readonly factorySendCatalog: IFactorySendCatalogPort,
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

    const catalog = await this.factorySendCatalog.readBySkus(
      input.organizationId,
      purchaseOrder.lines.map((line) => line.sku),
    );
    const totCartons = totalCartons(purchaseOrder.lines, catalog);

    const rows: WorkbookRow[] = [];
    for (const line of purchaseOrder.lines) {
      const link = await this.supplierProducts.findBySupplierAndSku(
        purchaseOrder.supplierId,
        line.sku,
      );
      rows.push(toFactoryRow(purchaseOrder, line, link, totCartons));
    }

    const file = await this.workbookWriter.write({
      sheetName: purchaseOrder.documentNumber,
      columns: FACTORY_PO_COLUMNS,
      rows,
      format: input.format,
    });

    return { ok: true, file };
  }
}

export function totalCartons(
  lines: readonly PurchaseOrderLine[],
  catalog: ReadonlyMap<string, { caseQty: number | null }>,
): number | "" {
  let total = 0;
  for (const line of lines) {
    const caseQty = catalog.get(line.sku.value)?.caseQty ?? null;
    if (caseQty === null || caseQty <= 0) {
      return EMPTY;
    }
    total += Math.ceil(line.qty / caseQty);
  }
  return total;
}

function toFactoryRow(
  purchaseOrder: PurchaseOrder,
  line: PurchaseOrderLine,
  link: SupplierProduct | null,
  totCartons: number | "",
): WorkbookRow {
  const cents = link?.lastPoCostCents ?? null;
  const price = cents === null ? EMPTY : cents / 100;
  const extprice = cents === null ? EMPTY : (line.qty * cents) / 100;
  return {
    ship_date: excelDateFromIso(purchaseOrder.shipDate),
    canc_date: excelDateFromIso(purchaseOrder.cancelDate),
    mat_num: line.sku.value,
    quan: line.qty,
    price,
    extprice,
    description: line.name,
    mfg_code: link?.supplierSku ?? EMPTY,
    mfg_sku: EMPTY,
    mfg_upc: EMPTY,
    product_upc_1: EMPTY,
    cs_cube_metric: 0,
    tot_cartons: totCartons,
    tot_cbm: CUBE_UNAVAILABLE,
  };
}
