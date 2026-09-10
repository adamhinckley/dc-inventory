"use client";

import { useListInternalPurchaseOrders } from "@dc-inventory/api-client-internal";
import {
  DataTable,
  unwrapListData,
  type ListQueryHook,
  type ListQueryParams,
  type ListQueryResult,
} from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, useMemo, type ReactNode } from "react";
import { purchaseOrderRemainingQty } from "../lib/purchase-order-line-math";
import { purchaseOrderStatusFilterOptions } from "../lib/purchase-order-status-filter";
import { receivingListTable } from "../lib/receiving-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";

type InboundListParams = NonNullable<
  Parameters<typeof useListInternalPurchaseOrders>[0]
>;

type InboundLine = {
  qty: number;
  receivedQty: number;
};

type InboundRow = Record<string, unknown> & {
  id: string;
  remaining: number;
  lines: readonly InboundLine[];
};

function withRemaining(row: Record<string, unknown>): InboundRow {
  const lines = (row.lines ?? []) as readonly InboundLine[];
  return {
    ...row,
    id: String(row.id ?? ""),
    lines,
    remaining: purchaseOrderRemainingQty(lines),
  };
}

const useReceivingInboundList: ListQueryHook<InboundListParams, InboundRow> = (
  params,
) => {
  const query = useListInternalPurchaseOrders(params);

  const data = useMemo((): ListQueryResult<InboundRow>["data"] => {
    const envelope = unwrapListData(
      query.data as ListQueryResult<InboundRow>["data"],
    );
    if (!envelope) {
      return query.data as ListQueryResult<InboundRow>["data"];
    }

    const items = envelope.items.map((item) =>
      withRemaining(item as Record<string, unknown>),
    );

    const orval = query.data;
    if (
      orval &&
      typeof orval === "object" &&
      "data" in orval &&
      orval.data &&
      typeof orval.data === "object" &&
      "items" in orval.data
    ) {
      return {
        ...orval,
        data: {
          ...orval.data,
          items,
        },
      } as ListQueryResult<InboundRow>["data"];
    }

    return {
      ...envelope,
      items,
    };
  }, [query.data]);

  return {
    ...query,
    data,
  };
};

export function ReceivingInboundTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const seededInitialParams = useMemo(() => {
    if (initialParams?.status !== undefined) {
      return initialParams;
    }
    return { ...initialParams, status: "confirmed" };
  }, [initialParams]);

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(receivingListTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/procurement/receiving/${row.id}` : undefined;
  }, []);

  const renderRowLink = useCallback(
    ({ href, children }: { href: string; children: ReactNode }) => (
      <Link href={href} className="text-link hover:text-link-hover">
        {children}
      </Link>
    ),
    [],
  );

  return (
    <DataTable.Root<InboundListParams, InboundRow>
      meta={receivingListTable}
      queryHook={useReceivingInboundList}
      initialParams={seededInitialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="documentNumber"
      renderRowLink={renderRowLink}
      filterOptions={{ status: purchaseOrderStatusFilterOptions }}
      filterLabels={{ status: "Status" }}
      idPrefix="receiving-inbound"
    >
      <DataTable.Toolbar>
        <DataTable.Search />
        <DataTable.Filters />
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
