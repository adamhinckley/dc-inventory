"use client";

import {
  listInternalPurchaseOrdersTable,
  useListInternalPurchaseOrders,
} from "@dc-inventory/api-client-internal";
import { Chip } from "@dc-inventory/ui";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import { purchaseOrderStatusPresentation } from "../lib/purchase-order-status-chip";
import { replaceTableUrlParams } from "../lib/table-url-params";

function useDraftPurchaseOrdersList(
  params?: Parameters<typeof useListInternalPurchaseOrders>[0],
) {
  return useListInternalPurchaseOrders({
    ...params,
    status: "draft",
  });
}

export function PurchaseOrdersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalPurchaseOrdersTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/procurement/purchase-orders/${row.id}` : undefined;
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
    <DataTable.Root
      meta={listInternalPurchaseOrdersTable}
      queryHook={useDraftPurchaseOrdersList as ListQueryHook<
        Parameters<typeof useListInternalPurchaseOrders>[0]
      >}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="documentNumber"
      renderRowLink={renderRowLink}
      renderColumns={{
        status: (row) => {
          const presentation = purchaseOrderStatusPresentation(row.status);
          if (presentation === null) {
            return "—";
          }
          return (
            <Chip
              icon={<Chip.Dot />}
              style={{ "--chip-color": presentation.color } as CSSProperties}
            >
              {presentation.label}
            </Chip>
          );
        },
      }}
      idPrefix="draft-purchase-orders"
    >
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
