import type { ConfirmSalesOrderResult, SalesOrder } from "@dc-inventory/sales";

export function toInsufficientAtpBody(
  result: Extract<ConfirmSalesOrderResult, { reason: "insufficient_atp" }>,
) {
  const shortage = result.shortage;
  return {
    error: "insufficient_atp" as const,
    ...(shortage !== undefined
      ? {
          sku: shortage.sku,
          name: shortage.name,
          requestedQty: shortage.requestedQty,
          availableQty: shortage.availableQty,
        }
      : {}),
  };
}

export async function mapSalesOrder(
  order: SalesOrder,
  lookupProductId: (sku: string) => Promise<string | null>,
  lookupCustomerName: (customerId: string) => Promise<string | null>,
) {
  const customerName = await lookupCustomerName(order.customerId);
  const lines = await Promise.all(
    order.lines.map(async (line) => {
      const productId = await lookupProductId(line.sku.value);
      return {
        id: line.id,
        ...(productId !== null ? { productId } : {}),
        sku: line.sku.value,
        name: line.name,
        qty: line.qty,
        unitPriceCents: line.unitPrice.amountMinor,
        currency: line.unitPrice.currency,
        taxCategoryCode: line.taxCategoryCode,
      };
    }),
  );

  return {
    id: order.id,
    customerId: order.customerId,
    ...(customerName !== null ? { customerName } : {}),
    documentNumber: order.documentNumber,
    status: order.status,
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2,
    shipCity: order.shipCity,
    shipRegion: order.shipRegion,
    shipPostal: order.shipPostal,
    shipCountry: order.shipCountry,
    lines,
  };
}
