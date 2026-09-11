"use client";

import {
  getListInternalPurchaseOrdersQueryKey,
  getListInternalPreOrderFactoriesQueryKey,
  getListInternalPreOrderSkusQueryKey,
  useDraftInternalPreOrderPurchaseOrders,
  useListInternalPreOrderSkus,
} from "@dc-inventory/api-client-internal";
import {
  unwrapListData,
  useDataTable,
  type ListQueryHook,
  type ListQueryParams,
  type ListQueryResult,
} from "@dc-inventory/ui-internal";
import {
  Button,
  Chip,
  Table,
  useTable,
  type TableColumnDef,
} from "@dc-inventory/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { isPreOrderNeedsMappingFactoryId } from "../lib/uncovered-constants";
import {
  listAllPreOrderFactories,
  type UncoveredFactoryRow,
} from "../lib/list-all-uncovered-factories";
import {
  afterDraftPreOrderPos,
  shouldDraftUncoveredSelection,
  type UncoveredBatchDraftRow,
} from "../lib/uncovered-draft-workflow";
import { suggestedDraftPoQty } from "../lib/purchase-order-line-math";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { preOrderListTable } from "../lib/uncovered-list-table";
import { UncoveredBatchDraftModal } from "./uncovered-batch-draft-modal";
import { MissingSupplierPoPrefixDialog } from "./missing-supplier-po-prefix-dialog";
import { loadSuppliersMissingPoPrefix } from "../lib/missing-supplier-po-prefix";
import type { SupplierDetail } from "../lib/supplier-types";

type PreOrderListParams = NonNullable<
  Parameters<typeof useListInternalPreOrderSkus>[0]
>;

type PreOrderApiRow = {
  sku: string;
  toOrder: number;
  onHand: number;
  onOrder: number;
  committed: number;
  caseQty: number | null;
  reorderMin: number | null;
  reorderMax: number | null;
  supplierId: string | null;
  supplierNumber: string | null;
  supplierName: string | null;
  mappingStatus: "mapped" | "unmapped" | "ambiguous";
  draftPurchaseOrder: { id: string; documentNumber: string } | null;
};

type PreOrderRow = PreOrderApiRow & {
  suggestedQty: number;
};

function withSuggestedQty(row: PreOrderApiRow): PreOrderRow {
  return {
    ...row,
    suggestedQty: suggestedDraftPoQty(row.toOrder, row.caseQty ?? null),
  };
}

function buildSkuListParams(
  factoryId: string,
  params: ListQueryParams = {},
): PreOrderListParams {
  if (isPreOrderNeedsMappingFactoryId(factoryId)) {
    return {
      ...params,
      needsMapping: "true",
      supplierId: undefined,
    };
  }
  return {
    ...params,
    supplierId: factoryId,
    needsMapping: undefined,
  };
}

function usePreOrderFactorySkuList(
  factoryId: string,
): ListQueryHook<PreOrderListParams, PreOrderRow> {
  return (params) => {
    const query = useListInternalPreOrderSkus(buildSkuListParams(factoryId, params));

    const data = useMemo((): ListQueryResult<PreOrderRow>["data"] => {
      const envelope = unwrapListData(
        query.data as ListQueryResult<PreOrderRow>["data"],
      );
      if (!envelope) {
        return query.data as ListQueryResult<PreOrderRow>["data"];
      }

      const items = envelope.items.map((item) =>
        withSuggestedQty(item as PreOrderApiRow),
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
        } as ListQueryResult<PreOrderRow>["data"];
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
}

function formatCell(row: PreOrderRow, field: keyof PreOrderRow): string {
  const value = row[field];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

function SkuCell({ row }: { row: PreOrderRow }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate font-medium">{row.sku}</span>
      {row.draftPurchaseOrder ? (
        <Link href={`/procurement/purchase-orders/${row.draftPurchaseOrder.id}`} className="w-fit">
          <Chip
            style={{ "--chip-color": "var(--color-status-open)" } as CSSProperties}
          >
            Draft {row.draftPurchaseOrder.documentNumber}
          </Chip>
        </Link>
      ) : null}
      {row.mappingStatus === "unmapped" ? (
        <Chip
          style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}
        >
          No factory
        </Chip>
      ) : null}
      {row.mappingStatus === "ambiguous" ? (
        <Chip
          style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}
        >
          Ambiguous factory
        </Chip>
      ) : null}
    </div>
  );
}

const DETAIL_COLUMN_SPECS = [
  { id: "toOrder", label: "To Order" },
  { id: "onHand", label: "On hand" },
  { id: "onOrder", label: "On order" },
  { id: "committed", label: "Pre-sold" },
  { id: "caseQty", label: "Master pack" },
  { id: "reorderMin", label: "Reorder min" },
  { id: "reorderMax", label: "Reorder max" },
  { id: "suggestedQty", label: "Suggested qty" },
] as const satisfies readonly { id: keyof PreOrderRow; label: string }[];

export function UncoveredFactoryDetail({
  factoryId,
  initialParams,
}: {
  factoryId: string;
  initialParams?: ListQueryParams;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<readonly UncoveredBatchDraftRow[]>(
    [],
  );
  const [batchUnmappedNotice, setBatchUnmappedNotice] = useState<string | null>(null);
  const [prefixWarningOpen, setPrefixWarningOpen] = useState(false);
  const [missingPrefixSuppliers, setMissingPrefixSuppliers] = useState<
    readonly SupplierDetail[]
  >([]);

  const needsMapping = isPreOrderNeedsMappingFactoryId(factoryId);
  const factoriesQuery = useQuery({
    queryKey: [...getListInternalPreOrderFactoriesQueryKey(), "all"],
    queryFn: () => listAllPreOrderFactories(),
  });
  const draftMutation = useDraftInternalPreOrderPurchaseOrders();
  const useSkuList = useMemo(
    () => usePreOrderFactorySkuList(factoryId),
    [factoryId],
  );

  const factorySummary = useMemo(
    () => factoriesQuery.data?.find((row) => row.id === factoryId),
    [factoriesQuery.data, factoryId],
  );

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(preOrderListTable, params);
  }, []);

  const { items, query, setState, total, page, pageSize, pageCount, busy, listFailed } =
    useDataTable({
      meta: preOrderListTable,
      queryHook: useSkuList,
      initialParams,
      onParamsChange,
    });

  const columns = useMemo<TableColumnDef<PreOrderRow>[]>(
    () => [
      {
        id: "sku",
        label: "SKU",
        sort: false,
        align: "left",
        flex: 1,
        render: ({ record }) => <SkuCell row={record} />,
      },
      ...DETAIL_COLUMN_SPECS.map(({ id, label }) => ({
        id,
        label,
        sort: false as const,
        align: "right" as const,
        render: ({ record }: { record: PreOrderRow }) => formatCell(record, id),
      })),
    ],
    [],
  );

  const table = useTable({
    data: items as PreOrderRow[],
    isPending: busy,
    isError: query.isError === true || listFailed,
    columns,
    getRowId: (row) => row.sku,
    fillColumn: "sku",
    enableSorting: false,
    enableSelection: !needsMapping,
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

  const selectedCount = table.selection.selectedIds.size;
  const actionLabel =
    selectedCount > 0 ? `Build PO (${selectedCount})` : "Build PO";

  const supplierNamesById = useMemo(() => {
    const names = new Map<string, string>();
    if (factorySummary?.supplierId !== null && factorySummary?.supplierId !== undefined) {
      names.set(factorySummary.supplierId, factorySummary.supplierName);
    }
    return names;
  }, [factorySummary]);

  const invalidatePreOrderQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListInternalPurchaseOrdersQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListInternalPreOrderFactoriesQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListInternalPreOrderSkusQueryKey(),
      }),
    ]);
  }, [queryClient]);

  const draftSelected = useCallback(async (options?: { skipPrefixWarning?: boolean }) => {
    if (creatingRef.current || needsMapping) {
      return;
    }
    const skus = [...table.selection.selectedIds];
    if (!shouldDraftUncoveredSelection(skus.length)) {
      return;
    }
    if (options?.skipPrefixWarning !== true) {
      try {
        const missing = await loadSuppliersMissingPoPrefix([
          factorySummary?.supplierId ?? factoryId,
        ]);
        if (missing.length > 0) {
          setMissingPrefixSuppliers(missing);
          setPrefixWarningOpen(true);
          return;
        }
      } catch {
        setActionError("Could not check this factory's PO prefix.");
        return;
      }
    }
    setPrefixWarningOpen(false);
    creatingRef.current = true;
    setActionError(null);
    setStatusMessage(null);
    try {
      const result = await draftMutation.mutateAsync({ data: { skus } });
      if (result.status !== 201) {
        setActionError("Could not create draft purchase order.");
        return;
      }
      table.selection.clear();
      await invalidatePreOrderQueries();
      const next = afterDraftPreOrderPos(
        result.data.purchaseOrders,
        result.data.unmappedSkus,
        supplierNamesById,
      );
      if (next.action === "stay") {
        setStatusMessage(
          next.unmappedNotice ?? "No draft purchase order was created.",
        );
        return;
      }
      if (next.action === "navigate") {
        router.push(`/procurement/purchase-orders/${next.purchaseOrderId}`);
        return;
      }
      setBatchDrafts(next.drafts);
      setBatchUnmappedNotice(next.unmappedNotice);
      setBatchModalOpen(true);
    } finally {
      creatingRef.current = false;
    }
  }, [
    draftMutation,
    factoryId,
    factorySummary?.supplierId,
    invalidatePreOrderQueries,
    needsMapping,
    router,
    supplierNamesById,
    table.selection,
  ]);

  if (factorySummary === undefined && factoriesQuery.isSuccess) {
    return (
      <p className="text-body-sm text-fg-secondary">
        Factory not found.{" "}
        <Link href="/procurement" className="text-link hover:text-link-hover">
          Back to factories
        </Link>
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <p className="text-body-sm text-fg-secondary">
        <Link href="/procurement" className="text-link hover:text-link-hover">
          ← All factories
        </Link>
      </p>

      {factorySummary ? (
        <header>
          <h2 className="text-heading-md font-semibold">{factorySummary.supplierName}</h2>
          <p className="page-description mt-2">
            {needsMapping ? (
              <>
                {factorySummary.productCount} product
                {factorySummary.productCount === 1 ? "" : "s"} ·{" "}
                {factorySummary.totalToOrderUnits} total toOrder units
              </>
            ) : (
              <>
                {factorySummary.productCount} product
                {factorySummary.productCount === 1 ? "" : "s"} ready for a purchase order ·{" "}
                {factorySummary.totalToOrderUnits} total toOrder units
              </>
            )}
          </p>
        </header>
      ) : null}

      {needsMapping ? (
        <p className="text-body-sm text-fg-secondary" role="note">
          Assign a factory on the supplier detail page before these SKUs can be drafted
          onto a PO.
        </p>
      ) : null}

      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="text-body-sm text-fg-secondary" role="status">
          {statusMessage}
        </p>
      ) : null}

      <Table
        sticky
        className="min-h-0 flex-1"
        table={table}
        emptyMessage="No toOrder SKUs for this factory"
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
        <Table.Pagination />
        {!needsMapping ? (
          <Table.BulkActions>
            <Button
              type="button"
              variant="primary"
              disabled={draftMutation.isPending}
              onClick={() => {
                void draftSelected();
              }}
              data-testid="uncovered-build-po"
            >
              <FilePlus2 className="size-icon" aria-hidden />
              {actionLabel}
            </Button>
          </Table.BulkActions>
        ) : null}
      </Table>

      <UncoveredBatchDraftModal
        open={batchModalOpen}
        drafts={batchDrafts}
        unmappedNotice={batchUnmappedNotice}
        onOpenChange={setBatchModalOpen}
      />
      <MissingSupplierPoPrefixDialog
        open={prefixWarningOpen}
        suppliers={missingPrefixSuppliers}
        pending={draftMutation.isPending}
        onOpenChange={setPrefixWarningOpen}
        onSubmitAnyway={() => {
          void draftSelected({ skipPrefixWarning: true });
        }}
      />
    </div>
  );
}
