import type { QueryKey } from "@tanstack/react-query";
import type { ListWholesaleSalesOrdersQueryResult } from "@dc-inventory/api-client-wholesale";
import { getListWholesaleSalesOrdersQueryKey } from "@dc-inventory/api-client-wholesale";
import type { QueryClient } from "@tanstack/react-query";
import { wholesaleDraftCartParams } from "./wholesale-draft-cart";

type DraftCartListData = Extract<ListWholesaleSalesOrdersQueryResult, { status: 200 }>["data"];
export type WholesaleDraftCartOrder = DraftCartListData["items"][number];

export type WholesaleDraftCartListResult = Extract<
  ListWholesaleSalesOrdersQueryResult,
  { status: 200 }
>;

export const wholesaleDraftCartQueryKey: QueryKey =
  getListWholesaleSalesOrdersQueryKey(wholesaleDraftCartParams);

export function readDraftCartList(
  queryClient: QueryClient,
): WholesaleDraftCartListResult | undefined {
  return queryClient.getQueryData<WholesaleDraftCartListResult>(wholesaleDraftCartQueryKey);
}

function writeDraftCartItems(
  queryClient: QueryClient,
  items: readonly WholesaleDraftCartOrder[],
): void {
  const previous = readDraftCartList(queryClient);
  queryClient.setQueryData<WholesaleDraftCartListResult>(wholesaleDraftCartQueryKey, {
    data: {
      items: [...items],
      page: previous?.data.page ?? wholesaleDraftCartParams.page,
      pageSize: previous?.data.pageSize ?? wholesaleDraftCartParams.pageSize,
      total: items.length,
    },
    status: 200,
    headers: previous?.headers ?? new Headers(),
  });
}

/**
 * Upsert one cart inside the cached open-carts list. A new draft goes first
 * (the list is newest-first); a cancelled or emptied draft drops out.
 * Sibling carts are left alone — that is what makes multi-cart surfaces agree.
 */
export function writeDraftCartOrder(
  queryClient: QueryClient,
  order: WholesaleDraftCartOrder,
): void {
  if (order.status !== "draft" || order.lines.length === 0) {
    removeDraftCartOrder(queryClient, order.id);
    return;
  }
  const items = readDraftCartList(queryClient)?.data.items ?? [];
  const exists = items.some((item) => item.id === order.id);
  writeDraftCartItems(
    queryClient,
    exists ? items.map((item) => (item.id === order.id ? order : item)) : [order, ...items],
  );
}

export function removeDraftCartOrder(queryClient: QueryClient, orderId: string): void {
  const items = readDraftCartList(queryClient)?.data.items ?? [];
  writeDraftCartItems(
    queryClient,
    items.filter((item) => item.id !== orderId),
  );
}

export function readDraftCartOrder(
  queryClient: QueryClient,
  orderId: string,
): WholesaleDraftCartOrder | undefined {
  return readDraftCartList(queryClient)?.data.items.find((item) => item.id === orderId);
}

export type OptimisticLineMeta = {
  name: string;
  unitPriceCents: number;
  currency: string;
  sku?: string;
};

/** Merge replace-lines payload onto the cached draft for instant cart feedback. */
export function buildOptimisticDraftOrder(
  draft: WholesaleDraftCartOrder,
  replacePayload: readonly { productId: string; qty: number }[],
  newLines: ReadonlyMap<string, OptimisticLineMeta> = new Map(),
): WholesaleDraftCartOrder {
  const existingByProductId = new Map(
    draft.lines
      .filter(
        (line): line is typeof line & { productId: string } => line.productId !== undefined,
      )
      .map((line) => [line.productId, line]),
  );

  const lines = replacePayload.map(({ productId, qty }) => {
    const existing = existingByProductId.get(productId);
    if (existing !== undefined) {
      return { ...existing, qty };
    }
    const meta = newLines.get(productId);
    return {
      id: `optimistic-${productId}`,
      productId,
      sku: meta?.sku ?? "",
      name: meta?.name ?? "",
      qty,
      unitPriceCents: meta?.unitPriceCents ?? 0,
      currency: meta?.currency ?? "USD",
    };
  });

  return { ...draft, lines };
}
