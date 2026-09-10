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
import { FilePlus2, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import type { UncoveredFactoryRow } from "../lib/list-all-uncovered-factories";
import { listPurchasing2UncoveredFactories } from "../lib/list-purchasing-2-uncovered-factories";
import { collectUncoveredSkusForFactories } from "../lib/uncovered-collect-skus";
import {
  isPurchasing2UncoveredNeedsMappingFactoryId,
  purchasing2PurchaseOrderHref,
  purchasing2UncoveredFactoryDetailHref,
} from "../lib/purchasing-2-uncovered-constants";
import { syncPurchasing2DraftPurchaseOrders } from "../lib/purchasing-2-sync-draft-pos";
import {
  afterDraftUncoveredPos,
  draftableUncoveredFactoryIds,
  type UncoveredBatchDraftRow,
} from "../lib/uncovered-draft-workflow";
import {
  factoriesMissingVendorPrefix,
  isSupplierPoPrefixMissing,
} from "../lib/missing-supplier-po-prefix";
import type { SupplierDetail } from "../lib/supplier-types";
import { VENDOR_PREFIX_COLUMN_TOOLTIP } from "../lib/vendor-prefix-column";
import { UncoveredBatchDraftModal } from "./uncovered-batch-draft-modal";
import { MissingSupplierPoPrefixDialog } from "./missing-supplier-po-prefix-dialog";
import { VendorPrefixEditDialog } from "./vendor-prefix-edit-dialog";

function FactoryNameCell({ row }: { row: UncoveredFactoryRow }) {
  if (row.needsMapping) {
    return (
      <Link
        href={purchasing2UncoveredFactoryDetailHref(row.id)}
        className="text-link hover:text-link-hover inline-flex min-w-0 items-center gap-field"
      >
        <Chip style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}>
          {row.supplierName}
        </Chip>
      </Link>
    );
  }

  return (
    <Link
      href={purchasing2UncoveredFactoryDetailHref(row.id)}
      className="text-link hover:text-link-hover block min-w-0 truncate font-medium"
    >
      {row.supplierName}
    </Link>
  );
}

function VendorPrefixCell({ row }: { row: UncoveredFactoryRow }) {
  if (row.needsMapping) {
    return "—";
  }
  if (isSupplierPoPrefixMissing(row.poPrefix)) {
    return (
      <Chip style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}>
        Missing
      </Chip>
    );
  }
  return <span className="font-mono tabular-nums">{row.poPrefix}</span>;
}

function formatFactoryCell(row: UncoveredFactoryRow, field: keyof UncoveredFactoryRow): string {
  const value = row[field];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

export function Purchasing2UncoveredSummary() {
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
  const [editingPrefixRow, setEditingPrefixRow] = useState<UncoveredFactoryRow | null>(
    null,
  );

  const factoriesQuery = useQuery({
    queryKey: [
      ...getListInternalUncoveredFactoriesQueryKey(),
      "purchasing-2",
      "excludeSuppliersWithOpenDraft",
    ],
    queryFn: () => listPurchasing2UncoveredFactories(),
  });
  const draftMutation = useDraftInternalUncoveredPurchaseOrders();

  const rows = factoriesQuery.data ?? [];
  const busy = factoriesQuery.isPending;
  const factoryIds = useMemo(() => draftableUncoveredFactoryIds(rows), [rows]);

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
        id: "poPrefix",
        label: "Vendor prefix",
        sort: false,
        align: "left",
        tooltip: VENDOR_PREFIX_COLUMN_TOOLTIP,
        render: ({ record }) => <VendorPrefixCell row={record} />,
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

  const rowActions = useCallback((row: UncoveredFactoryRow) => {
    if (row.needsMapping || row.supplierId === null) {
      return null;
    }
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditingPrefixRow(row)}
        data-testid={`purchasing-2-uncovered-edit-prefix-${row.supplierId}`}
      >
        <Pencil className="size-icon" aria-hidden />
        Edit Prefix
      </Button>
    );
  }, []);

  const table = useTable({
    data: rows,
    isPending: busy,
    isError: factoriesQuery.isError === true,
    columns,
    rowActions,
    getRowId: (row) => row.id,
    fillColumn: "supplierName",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  const needsMappingCount = rows.filter((row) =>
    isPurchasing2UncoveredNeedsMappingFactoryId(row.id),
  ).length;

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

  const saveAllDrafts = useCallback(async (options?: { skipPrefixWarning?: boolean }) => {
    if (creatingRef.current || factoryIds.length === 0) {
      return;
    }
    if (options?.skipPrefixWarning !== true) {
      const missing = factoriesMissingVendorPrefix(
        rows.filter((row) => factoryIds.includes(row.id)),
      );
      if (missing.length > 0) {
        setMissingPrefixSuppliers(missing);
        setPrefixWarningOpen(true);
        return;
      }
    }
    setPrefixWarningOpen(false);
    creatingRef.current = true;
    setActionError(null);
    setStatusMessage(null);
    try {
      const skus = await collectUncoveredSkusForFactories(factoryIds);
      if (skus.length === 0) {
        setStatusMessage("No uncovered SKUs found for these factories.");
        return;
      }
      const result = await draftMutation.mutateAsync({ data: { skus: [...skus] } });
      if (result.status !== 201) {
        setActionError("Could not create draft purchase orders.");
        return;
      }
      await invalidateUncoveredQueries();
      try {
        await syncPurchasing2DraftPurchaseOrders(queryClient, factoryIds);
      } catch {
        // Ignore a failed resync after a successful Save All Drafts.
      }
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
        router.push(purchasing2PurchaseOrderHref(next.purchaseOrderId));
        return;
      }
      setBatchDrafts(next.drafts);
      setBatchUnmappedNotice(next.unmappedNotice);
      setBatchModalOpen(true);
    } catch {
      setActionError("Could not load uncovered SKUs for these factories.");
    } finally {
      creatingRef.current = false;
    }
  }, [
    draftMutation,
    factoryIds,
    invalidateUncoveredQueries,
    queryClient,
    router,
    rows,
    supplierNamesById,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <div className="flex flex-wrap items-start justify-between gap-action">
        <p className="text-body-sm text-fg-secondary">
          Factories with uncovered demand that are not yet on an open draft purchase order.
          {needsMappingCount > 0
            ? " The needs-mapping row is read-only until supplier products are assigned."
            : null}
        </p>
        <Button
          type="button"
          variant="primary"
          disabled={factoryIds.length === 0 || draftMutation.isPending}
          onClick={() => {
            void saveAllDrafts();
          }}
          data-testid="purchasing-2-uncovered-save-all-drafts"
        >
          <FilePlus2 className="size-icon" aria-hidden />
          Save All Drafts
        </Button>
      </div>

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
        emptyMessage="No factories waiting for a first draft PO"
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>

      <UncoveredBatchDraftModal
        open={batchModalOpen}
        drafts={batchDrafts}
        unmappedNotice={batchUnmappedNotice}
        onOpenChange={setBatchModalOpen}
        purchaseOrderHref={purchasing2PurchaseOrderHref}
      />
      <MissingSupplierPoPrefixDialog
        open={prefixWarningOpen}
        suppliers={missingPrefixSuppliers}
        pending={draftMutation.isPending}
        onOpenChange={setPrefixWarningOpen}
        onSubmitAnyway={() => {
          void saveAllDrafts({ skipPrefixWarning: true });
        }}
      />
      {editingPrefixRow?.supplierId ? (
        <VendorPrefixEditDialog
          supplierId={editingPrefixRow.supplierId}
          supplierName={editingPrefixRow.supplierName}
          poPrefix={editingPrefixRow.poPrefix}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditingPrefixRow(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
