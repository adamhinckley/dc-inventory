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

export function writeDraftCartOrder(
  queryClient: QueryClient,
  order: WholesaleDraftCartOrder | null,
): void {
  const previous = readDraftCartList(queryClient);
  queryClient.setQueryData<WholesaleDraftCartListResult>(wholesaleDraftCartQueryKey, {
    data: {
      items: order === null ? [] : [order],
      page: previous?.data.page ?? wholesaleDraftCartParams.page,
      pageSize: previous?.data.pageSize ?? wholesaleDraftCartParams.pageSize,
      total: order === null ? 0 : 1,
    },
    status: 200,
    headers: previous?.headers ?? new Headers(),
  });
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
