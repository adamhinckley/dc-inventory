"use client";

import {
  getListInternalPurchaseOrdersQueryKey,
  useDraftInternalUncoveredPurchaseOrders,
  useListInternalUncoveredSkus,
} from "@dc-inventory/api-client-internal";
import {
  unwrapListData,
  useDataTable,
  type ListQueryHook,
  type ListQueryParams,
  type ListQueryResult,
} from "@dc-inventory/ui-internal";
import { Button, Table, useTable, type TableColumnDef } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  afterDraftUncoveredPos,
  shouldDraftUncoveredSelection,
} from "../lib/uncovered-draft-workflow";
import { suggestedDraftPoQty } from "../lib/purchase-order-line-math";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { uncoveredListTable } from "../lib/uncovered-list-table";

type UncoveredListParams = NonNullable<
  Parameters<typeof useListInternalUncoveredSkus>[0]
>;

type UncoveredApiRow = {
  sku: string;
  uncovered: number;
  onHand: number;
  onOrder: number;
  committed: number;
  caseQty: number | null;
  reorderMin: number | null;
  reorderMax: number | null;
};

type UncoveredRow = UncoveredApiRow & {
  suggestedQty: number;
};

function withSuggestedQty(row: UncoveredApiRow): UncoveredRow {
  return {
    ...row,
    suggestedQty: suggestedDraftPoQty(row.uncovered, row.caseQty ?? null),
  };
}

const useUncoveredList: ListQueryHook<UncoveredListParams, UncoveredRow> = (params) => {
  const query = useListInternalUncoveredSkus(params);

  const data = useMemo((): ListQueryResult<UncoveredRow>["data"] => {
    const envelope = unwrapListData(
      query.data as ListQueryResult<UncoveredRow>["data"],
    );
    if (!envelope) {
      return query.data as ListQueryResult<UncoveredRow>["data"];
    }

    const items = envelope.items.map((item) =>
      withSuggestedQty(item as UncoveredApiRow),
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
      } as ListQueryResult<UncoveredRow>["data"];
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

function formatCell(row: UncoveredRow, field: string): string {
  const value = row[field as keyof UncoveredRow];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

export function UncoveredSkusTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unmappedNotice, setUnmappedNotice] = useState<string | null>(null);
  const draftMutation = useDraftInternalUncoveredPurchaseOrders();

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(uncoveredListTable, params);
  }, []);

  const { items, query, state, setState, total, page, pageSize, pageCount } =
    useDataTable({
      meta: uncoveredListTable,
      queryHook: useUncoveredList,
      initialParams,
      onParamsChange,
    });

  const envelope = unwrapListData(query.data);
  const busy =
    query.isPending === true ||
    query.isLoading === true ||
    (envelope === undefined && query.isError !== true);

  const columns = useMemo<TableColumnDef<UncoveredRow>[]>(
    () =>
      uncoveredListTable.columns.map((column) => ({
        id: column.field,
        label: column.label,
        sort: false as const,
        align:
          column.field === "sku" ||
          column.field === "reorderMin" ||
          column.field === "reorderMax"
            ? "left"
            : "right",
        truncate: column.field === "sku",
        render: ({ record }) => formatCell(record, column.field),
      })),
    [],
  );

  const table = useTable({
    data: items as UncoveredRow[],
    isPending: busy,
    isError: query.isError === true,
    columns,
    getRowId: (row) => row.sku,
    fillColumn: "sku",
    enableSorting: false,
    enableSelection: true,
    enablePagination: true,
    pagination: {
      page: Math.max(0, page - 1),
      pageSize,
      totalRows: total,
      canPreviousPage: page > 1,
      canNextPage: page < pageCount,
    },
    onPaginationChange: (action) => {
      setState((current) => {
        if (action.type === "next") {
          return { ...current, page: current.page + 1 };
        }
        if (action.type === "previous") {
          return { ...current, page: Math.max(1, current.page - 1) };
        }
        return { ...current, page: 1, pageSize: action.pageSize };
      });
    },
  });

  const draftSelected = useCallback(async () => {
    if (creatingRef.current) {
      return;
    }
    const skus = [...table.selection.selectedIds];
    if (!shouldDraftUncoveredSelection(skus.length)) {
      return;
    }
    creatingRef.current = true;
    setActionError(null);
    setUnmappedNotice(null);
    try {
      const result = await draftMutation.mutateAsync({ data: { skus } });
      if (result.status !== 201) {
        setActionError("Could not create draft purchase orders.");
        return;
      }
      table.selection.clear();
      void queryClient.invalidateQueries({
        queryKey: getListInternalPurchaseOrdersQueryKey(),
      });
      const next = afterDraftUncoveredPos(
        result.data.purchaseOrders,
        result.data.unmappedSkus,
      );
      if (next.action === "stay") {
        setUnmappedNotice(next.unmappedNotice);
        return;
      }
      router.push(`/purchasing/${next.purchaseOrderId}`);
    } finally {
      creatingRef.current = false;
    }
  }, [draftMutation, queryClient, router, table.selection]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      {actionError ? (
        <p className="text-body-sm text-error" role="alert">{actionError}</p>
      ) : null}
      {unmappedNotice ? (
        <p className="text-body-sm text-fg-secondary" role="status">{unmappedNotice}</p>
      ) : null}
      <Table
        sticky
        className="min-h-0 flex-1"
        table={table}
        emptyMessage="No uncovered SKUs"
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
        <Table.Pagination />
        <Table.BulkActions>
          <Button
            type="button"
            variant="primary"
            disabled={draftMutation.isPending}
            onClick={() => {
              void draftSelected();
            }}
            data-testid="uncovered-draft-pos"
          >
            <FilePlus2 className="size-icon" aria-hidden />
            Draft POs
          </Button>
        </Table.BulkActions>
      </Table>
    </div>
  );
}
