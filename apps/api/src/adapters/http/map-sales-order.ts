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

function collectSalesOrderListSkus(orders: readonly SalesOrder[]): string[] {
  const skus = new Set<string>();
  for (const order of orders) {
    for (const line of order.lines) {
      skus.add(line.sku.value);
    }
  }
  return [...skus];
}

export async function mapSalesOrderListItems(
  orders: readonly SalesOrder[],
  lookupProductId: (sku: string) => Promise<string | null>,
  lookupCustomerName: (customerId: string) => Promise<string | null>,
  lookupProductIds: (skus: readonly string[]) => Promise<ReadonlyMap<string, string | null>>,
) {
  const pageSkus = collectSalesOrderListSkus(orders);
  const productIdBySku =
    pageSkus.length > 0
      ? await lookupProductIds(pageSkus)
      : new Map<string, string | null>();
  return Promise.all(
    orders.map((order) =>
      mapSalesOrder(order, lookupProductId, lookupCustomerName, { productIdBySku }),
    ),
  );
}

type MapSalesOrderOptions = {
  lookupProductIds?: (skus: readonly string[]) => Promise<ReadonlyMap<string, string | null>>;
  productIdBySku?: ReadonlyMap<string, string | null>;
};

export async function mapSalesOrder(
  order: SalesOrder,
  lookupProductId: (sku: string) => Promise<string | null>,
  lookupCustomerName: (customerId: string) => Promise<string | null>,
  options?: MapSalesOrderOptions,
) {
  const customerName = await lookupCustomerName(order.customerId);
  const skus = order.lines.map((line) => line.sku.value);
  const resolvedProductIdsBySku =
    options?.productIdBySku ??
    (options?.lookupProductIds !== undefined && skus.length > 0
      ? await options.lookupProductIds(skus)
      : undefined);

  const lines = await Promise.all(
    order.lines.map(async (line) => {
      const batchProductId = resolvedProductIdsBySku?.get(line.sku.value);
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
