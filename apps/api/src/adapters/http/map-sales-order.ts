import type { ConfirmSalesOrderShortage, SalesOrder } from "@dc-inventory/sales";

export function toCreditExceededBody(result: {
  availableCreditCents?: number;
  orderTotalCents?: number;
}) {
  return {
    error: "credit_exceeded" as const,
    ...(result.availableCreditCents !== undefined
      ? { availableCreditCents: result.availableCreditCents }
      : {}),
    ...(result.orderTotalCents !== undefined ? { orderTotalCents: result.orderTotalCents } : {}),
  };
}

export function toInsufficientAtpBody(result: {
  shortage?: ConfirmSalesOrderShortage;
}) {
  return toLineShortageBody("insufficient_atp", result);
}

export function toInsufficientCoverBody(result: {
  shortage?: {
    sku: string;
    name: string;
    requestedQty: number;
    coveredQty: number;
  };
}) {
  const shortage = result.shortage;
  return {
    error: "insufficient_cover" as const,
    ...(shortage !== undefined
      ? {
          sku: shortage.sku,
          name: shortage.name,
          requestedQty: shortage.requestedQty,
          coveredQty: shortage.coveredQty,
        }
      : {}),
  };
}

function toLineShortageBody(
  error: "insufficient_atp",
  result: { shortage?: ConfirmSalesOrderShortage },
) {
  const shortage = result.shortage;
  return {
    error,
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
  lookupProductIds?: (skus: readonly string[]) => Promise<ReadonlyMap<string, string | null>>,
) {
  const customerName = await lookupCustomerName(order.customerId);
  const skus = order.lines.map((line) => line.sku.value);
  const productIdsBySku =
    lookupProductIds !== undefined && skus.length > 0
      ? await lookupProductIds(skus)
      : undefined;

  const lines = await Promise.all(
    order.lines.map(async (line) => {
      const batchProductId = productIdsBySku?.get(line.sku.value);
      const productId =
        batchProductId !== undefined
          ? batchProductId
          : await lookupProductId(line.sku.value);
      return {
        id: line.id,
        ...(productId !== null && productId !== undefined ? { productId } : {}),
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
    ...(order.label !== undefined ? { label: order.label } : {}),
    ...(order.creditLimitOverriddenByStaffUserId !== undefined
      ? { creditLimitOverriddenByStaffUserId: order.creditLimitOverriddenByStaffUserId }
      : {}),
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2,
    shipCity: order.shipCity,
    shipRegion: order.shipRegion,
    shipPostal: order.shipPostal,
    shipCountry: order.shipCountry,
    lines,
  };
}
