"use client";

import {
  getListInternalPurchaseOrdersQueryKey,
  getListInternalUncoveredFactoriesQueryKey,
  getListInternalUncoveredSkusQueryKey,
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
import { collectUncoveredSkusForFactories } from "../lib/uncovered-collect-skus";
import { listPurchasing2UncoveredFactories } from "../lib/list-purchasing-2-uncovered-factories";
import { syncPurchasing2DraftPurchaseOrders } from "../lib/purchasing-2-sync-draft-pos";
import {
  isPurchasing2UncoveredNeedsMappingFactoryId,
  purchasing2PurchaseOrderHref,
} from "../lib/purchasing-2-uncovered-constants";
import { afterDraftUncoveredPos } from "../lib/uncovered-draft-workflow";
import { loadSuppliersMissingPoPrefix } from "../lib/missing-supplier-po-prefix";
import type { SupplierRow } from "../lib/supplier-types";
import { suggestedDraftPoQty } from "../lib/purchase-order-line-math";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { uncoveredListTable } from "../lib/uncovered-list-table";
import { MissingSupplierPoPrefixDialog } from "./missing-supplier-po-prefix-dialog";

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
  supplierId: string | null;
  supplierNumber: string | null;
  supplierName: string | null;
  mappingStatus: "mapped" | "unmapped" | "ambiguous";
  draftPurchaseOrder: { id: string; documentNumber: string } | null;
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

function buildSkuListParams(
  factoryId: string,
  params: ListQueryParams = {},
): UncoveredListParams {
  if (isPurchasing2UncoveredNeedsMappingFactoryId(factoryId)) {
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

function useUncoveredFactorySkuList(
  factoryId: string,
): ListQueryHook<UncoveredListParams, UncoveredRow> {
  return (params) => {
    const query = useListInternalUncoveredSkus(buildSkuListParams(factoryId, params));

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
}

function formatCell(row: UncoveredRow, field: keyof UncoveredRow): string {
  const value = row[field];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

function SkuCell({ row }: { row: UncoveredRow }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate font-medium">{row.sku}</span>
      {row.draftPurchaseOrder ? (
        <Link href={purchasing2PurchaseOrderHref(row.draftPurchaseOrder.id)} className="w-fit">
          <Chip
            style={{ "--chip-color": "var(--color-status-open)" } as CSSProperties}
          >
            Draft {row.draftPurchaseOrder.documentNumber}
          </Chip>
        </Link>
      ) : null}
      {row.mappingStatus === "unmapped" ? (
        <Chip style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}>
          No factory
        </Chip>
      ) : null}
      {row.mappingStatus === "ambiguous" ? (
        <Chip style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}>
          Ambiguous factory
        </Chip>
      ) : null}
    </div>
  );
}

const DETAIL_COLUMN_SPECS = [
  { id: "uncovered", label: "Uncovered" },
  { id: "onHand", label: "On hand" },
  { id: "onOrder", label: "On order" },
  { id: "committed", label: "Committed (pre-sold)" },
  { id: "caseQty", label: "Master pack" },
  { id: "reorderMin", label: "Reorder min" },
  { id: "reorderMax", label: "Reorder max" },
  { id: "suggestedQty", label: "Suggested qty" },
] as const satisfies readonly { id: keyof UncoveredRow; label: string }[];

export function Purchasing2UncoveredDetail({
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
  const [prefixWarningOpen, setPrefixWarningOpen] = useState(false);
  const [missingPrefixSuppliers, setMissingPrefixSuppliers] = useState<
    readonly SupplierRow[]
  >([]);

  const needsMapping = isPurchasing2UncoveredNeedsMappingFactoryId(factoryId);
  const factoriesQuery = useQuery({
    queryKey: [
      ...getListInternalUncoveredFactoriesQueryKey(),
      "purchasing-2",
      "excludeSuppliersWithOpenDraft",
    ],
    queryFn: () => listPurchasing2UncoveredFactories(),
  });
  const draftMutation = useDraftInternalUncoveredPurchaseOrders();
  const useSkuList = useMemo(
    () => useUncoveredFactorySkuList(factoryId),
    [factoryId],
  );

  const factorySummary = useMemo(
    () => factoriesQuery.data?.find((row) => row.id === factoryId),
    [factoriesQuery.data, factoryId],
  );

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(uncoveredListTable, params);
  }, []);

  const { items, query, setState, total, page, pageSize, pageCount } =
    useDataTable({
      meta: uncoveredListTable,
      queryHook: useSkuList,
      initialParams,
      onParamsChange,
    });

  const envelope = unwrapListData(query.data);
  const busy =
    query.isPending === true ||
    query.isLoading === true ||
    (envelope === undefined && query.isError !== true);

  const columns = useMemo<TableColumnDef<UncoveredRow>[]>(
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
        render: ({ record }: { record: UncoveredRow }) => formatCell(record, id),
      })),
    ],
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
    enableSelection: false,
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

  const supplierNamesById = useMemo(() => {
    const names = new Map<string, string>();
    if (factorySummary?.supplierId !== null && factorySummary?.supplierId !== undefined) {
      names.set(factorySummary.supplierId, factorySummary.supplierName);
    }
    return names;
  }, [factorySummary]);

  const invalidateUncoveredQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListInternalPurchaseOrdersQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListInternalUncoveredFactoriesQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListInternalUncoveredSkusQueryKey(),
      }),
    ]);
  }, [queryClient]);

  const saveDraft = useCallback(async (options?: { skipPrefixWarning?: boolean }) => {
    if (creatingRef.current || needsMapping) {
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
      const skus = await collectUncoveredSkusForFactories([factoryId]);
      if (skus.length === 0) {
        setStatusMessage("No uncovered SKUs found for this factory.");
        return;
      }
      const result = await draftMutation.mutateAsync({ data: { skus: [...skus] } });
      if (result.status !== 201) {
        setActionError("Could not create draft purchase order.");
        return;
      }
      await invalidateUncoveredQueries();
      try {
        await syncPurchasing2DraftPurchaseOrders(queryClient, [factoryId]);
      } catch {
        // Ignore a failed resync after a successful Save Draft.
      }
      const next = afterDraftUncoveredPos(
        result.data.purchaseOrders,
        result.data.unmappedSkus,
        supplierNamesById,
      );
      if (next.action === "stay") {
        setStatusMessage(next.unmappedNotice ?? "No draft purchase order was created.");
        return;
      }
      if (next.action === "navigate") {
        router.push(purchasing2PurchaseOrderHref(next.purchaseOrderId));
        return;
      }
      if (next.drafts.length === 1) {
        router.push(purchasing2PurchaseOrderHref(next.drafts[0]!.purchaseOrderId));
        return;
      }
      router.push("/purchasing-2");
    } catch {
      setActionError("Could not load uncovered SKUs for this factory.");
    } finally {
      creatingRef.current = false;
    }
  }, [
    draftMutation,
    factoryId,
    factorySummary?.supplierId,
    invalidateUncoveredQueries,
    needsMapping,
    queryClient,
    router,
    supplierNamesById,
  ]);

  if (factorySummary === undefined && factoriesQuery.isSuccess) {
    return (
      <p className="text-body-sm text-fg-secondary">
        Factory not found.{" "}
        <Link href="/purchasing-2/uncovered" className="text-link hover:text-link-hover">
          Back to uncovered
        </Link>
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <p className="text-body-sm text-fg-secondary">
        <Link href="/purchasing-2/uncovered" className="text-link hover:text-link-hover">
          ← Uncovered without draft
        </Link>
      </p>

      {factorySummary ? (
        <header className="flex flex-wrap items-start justify-between gap-action">
          <div>
            <h2 className="text-heading-md font-semibold">{factorySummary.supplierName}</h2>
            <p className="page-description mt-2">
              {needsMapping ? (
                <>
                  {factorySummary.productCount} product
                  {factorySummary.productCount === 1 ? "" : "s"} ·{" "}
                  {factorySummary.totalUncoveredUnits} total uncovered units
                </>
              ) : (
                <>
                  {factorySummary.productCount} product
                  {factorySummary.productCount === 1 ? "" : "s"} ready for a first draft PO ·{" "}
                  {factorySummary.totalUncoveredUnits} total uncovered units
                </>
              )}
            </p>
          </div>
          {!needsMapping ? (
            <Button
              type="button"
              variant="primary"
              disabled={draftMutation.isPending}
              onClick={() => {
                void saveDraft();
              }}
              data-testid="purchasing-2-uncovered-save-draft"
            >
              <FilePlus2 className="size-icon" aria-hidden />
              Save Draft
            </Button>
          ) : null}
        </header>
      ) : null}

      {needsMapping ? (
        <p className="text-body-sm text-fg-secondary" role="note">
          Read-only worksheet. Assign a factory on the supplier detail page before these SKUs
          can be drafted onto a PO.
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
        emptyMessage="No uncovered SKUs for this factory"
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
        <Table.Pagination />
      </Table>

      <MissingSupplierPoPrefixDialog
        open={prefixWarningOpen}
        suppliers={missingPrefixSuppliers}
        pending={draftMutation.isPending}
        onOpenChange={setPrefixWarningOpen}
        onSubmitAnyway={() => {
          void saveDraft({ skipPrefixWarning: true });
        }}
      />
    </div>
  );
}
