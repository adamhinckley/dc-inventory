"use client";

import {
  getListInternalPurchaseOrdersQueryKey,
  getListInternalUncoveredFactoriesQueryKey,
  getListInternalUncoveredSkusQueryKey,
  useDraftInternalUncoveredPurchaseOrders,
} from "@dc-inventory/api-client-internal";
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
import {
  isUncoveredNeedsMappingFactoryId,
  uncoveredFactoryDetailHref,
} from "../lib/uncovered-constants";
import {
  listAllUncoveredFactories,
  type UncoveredFactoryRow,
} from "../lib/list-all-uncovered-factories";
import {
  afterDraftUncoveredPos,
  type UncoveredBatchDraftRow,
} from "../lib/uncovered-draft-workflow";
import { UncoveredBatchDraftModal } from "./uncovered-batch-draft-modal";
import { MissingSupplierPoPrefixDialog } from "./missing-supplier-po-prefix-dialog";
import { loadSuppliersMissingPoPrefix } from "../lib/missing-supplier-po-prefix";
import type { SupplierRow } from "../lib/supplier-types";

function FactoryNameCell({ row }: { row: UncoveredFactoryRow }) {
  if (row.needsMapping) {
    return (
      <Link
        href={uncoveredFactoryDetailHref(row.id)}
        className="text-link hover:text-link-hover inline-flex min-w-0 items-center gap-field"
      >
        <Chip
          style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}
        >
          {row.supplierName}
        </Chip>
      </Link>
    );
  }

  return (
    <Link
      href={uncoveredFactoryDetailHref(row.id)}
      className="text-link hover:text-link-hover block min-w-0 truncate font-medium"
    >
      {row.supplierName}
    </Link>
  );
}

function formatFactoryCell(row: UncoveredFactoryRow, field: keyof UncoveredFactoryRow): string {
  const value = row[field];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

export function UncoveredFactorySummary() {
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
    readonly SupplierRow[]
  >([]);

  const factoriesQuery = useQuery({
    queryKey: [...getListInternalUncoveredFactoriesQueryKey(), "all"],
    queryFn: () => listAllUncoveredFactories(),
  });
  const draftMutation = useDraftInternalUncoveredPurchaseOrders();

  const rows = factoriesQuery.data ?? [];
  const busy = factoriesQuery.isPending;

  const supplierNamesById = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of rows) {
      if (row.supplierId !== null) {
        names.set(row.supplierId, row.supplierName);
      }
    }
    return names;
  }, [rows]);

  const columns = useMemo<TableColumnDef<UncoveredFactoryRow>[]>(
    () => [
      {
        id: "supplierName",
        label: "Factory",
        sort: false,
        align: "left",
        flex: 1,
        truncate: true,
        render: ({ record }) => <FactoryNameCell row={record} />,
      },
      {
        id: "supplierNumber",
        label: "Factory #",
        sort: false,
        align: "left",
        render: ({ record }) => formatFactoryCell(record, "supplierNumber"),
      },
      {
        id: "productCount",
        label: "Products",
        sort: false,
        align: "right",
        render: ({ record }) => formatFactoryCell(record, "productCount"),
      },
      {
        id: "totalUncoveredUnits",
        label: "Total uncovered",
        sort: false,
        align: "right",
        render: ({ record }) => formatFactoryCell(record, "totalUncoveredUnits"),
      },
    ],
    [],
  );

  const table = useTable({
    data: rows,
    isPending: busy,
    isError: factoriesQuery.isError === true,
    columns,
    getRowId: (row) => row.id,
    fillColumn: "supplierName",
    enableSorting: false,
    enableSelection: true,
    enablePagination: false,
  });

  const draftableFactoryIds = [...table.selection.selectedIds].filter(
    (factoryId) => !isUncoveredNeedsMappingFactoryId(factoryId),
  );
  const actionLabel =
    draftableFactoryIds.length > 0
      ? `Draft POs (${draftableFactoryIds.length})`
      : "Draft POs";

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

  const draftSelected = useCallback(async (options?: { skipPrefixWarning?: boolean }) => {
    if (creatingRef.current || draftableFactoryIds.length === 0) {
      return;
    }
    if (options?.skipPrefixWarning !== true) {
      try {
        const selected = rows.filter((row) => draftableFactoryIds.includes(row.id));
        const missing = await loadSuppliersMissingPoPrefix(
          selected.map((row) => row.supplierId ?? row.id),
        );
        if (missing.length > 0) {
          setMissingPrefixSuppliers(missing);
          setPrefixWarningOpen(true);
          return;
        }
      } catch {
        setActionError("Could not check PO prefixes for the selected factories.");
        return;
      }
    }
    setPrefixWarningOpen(false);
    creatingRef.current = true;
    setActionError(null);
    setStatusMessage(null);
    try {
      const skus = await collectUncoveredSkusForFactories(draftableFactoryIds);
      if (skus.length === 0) {
        setStatusMessage("No uncovered SKUs found for the selected factories.");
        return;
      }
      const result = await draftMutation.mutateAsync({ data: { skus: [...skus] } });
      if (result.status !== 201) {
        setActionError("Could not create draft purchase orders.");
        return;
      }
      table.selection.clear();
      await invalidateUncoveredQueries();
      const next = afterDraftUncoveredPos(
        result.data.purchaseOrders,
        result.data.unmappedSkus,
        supplierNamesById,
      );
      if (next.action === "stay") {
        setStatusMessage(next.unmappedNotice ?? "No draft purchase orders were created.");
        return;
      }
      if (next.action === "navigate") {
        router.push(`/purchasing/${next.purchaseOrderId}`);
        return;
      }
      setBatchDrafts(next.drafts);
      setBatchUnmappedNotice(next.unmappedNotice);
      setBatchModalOpen(true);
    } catch {
      setActionError("Could not load uncovered SKUs for the selected factories.");
    } finally {
      creatingRef.current = false;
    }
  }, [
    draftMutation,
    draftableFactoryIds,
    invalidateUncoveredQueries,
    router,
    rows,
    supplierNamesById,
    table.selection,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
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
        emptyMessage="No factories with uncovered demand"
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
        <Table.BulkActions>
          <Button
            type="button"
            variant="primary"
            disabled={draftableFactoryIds.length === 0 || draftMutation.isPending}
            onClick={() => {
              void draftSelected();
            }}
            data-testid="uncovered-draft-factories"
          >
            <FilePlus2 className="size-icon" aria-hidden />
            {actionLabel}
          </Button>
        </Table.BulkActions>
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
