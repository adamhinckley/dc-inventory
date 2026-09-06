"use client";

import {
  Button,
  Chip,
  Table,
  useTable,
  type TableColumnDef,
} from "@dc-inventory/ui";
import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { suggestedDraftPoQty } from "../../lib/purchase-order-line-math";
import {
  NEEDS_MAPPING_VENDOR_KEY,
  PROTOTYPE_UNCOVERED_ROWS,
  prototypeDraftPurchaseOrders,
  rowsForVendorKey,
  vendorSummaryByKey,
  type PrototypeUncoveredRow,
} from "./uncovered-vendor-prototype-mock";

type DisplayRow = PrototypeUncoveredRow & {
  suggestedQty: number;
};

function withSuggestedQty(row: PrototypeUncoveredRow): DisplayRow {
  return {
    ...row,
    suggestedQty: suggestedDraftPoQty(row.uncovered, row.caseQty),
  };
}

function formatCell(row: DisplayRow, field: keyof DisplayRow): string {
  const value = row[field];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

function SkuCell({ row }: { row: DisplayRow }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate font-medium">{row.sku}</span>
      {row.draftPurchaseOrder ? (
        <Link
          href={`/purchasing/${row.draftPurchaseOrder.id}`}
          className="w-fit"
        >
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

export function UncoveredVendorDetail({ vendorKey }: { vendorKey: string }) {
  const router = useRouter();
  const summary = vendorSummaryByKey(vendorKey);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);

  const rows = useMemo(
    () => rowsForVendorKey(vendorKey).map(withSuggestedQty),
    [vendorKey],
  );

  const columns = useMemo<TableColumnDef<DisplayRow>[]>(
    () => [
      {
        id: "sku",
        label: "SKU",
        sort: false,
        align: "left",
        fill: true,
        render: ({ record }) => <SkuCell row={record} />,
      },
      {
        id: "uncovered",
        label: "Uncovered",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "uncovered"),
      },
      {
        id: "onHand",
        label: "On hand",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "onHand"),
      },
      {
        id: "onOrder",
        label: "On order",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "onOrder"),
      },
      {
        id: "committed",
        label: "Committed (pre-sold)",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "committed"),
      },
      {
        id: "caseQty",
        label: "Master pack",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "caseQty"),
      },
      {
        id: "reorderMin",
        label: "Reorder min",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "reorderMin"),
      },
      {
        id: "reorderMax",
        label: "Reorder max",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "reorderMax"),
      },
      {
        id: "suggestedQty",
        label: "Suggested qty",
        sort: false,
        align: "right",
        render: ({ record }) => formatCell(record, "suggestedQty"),
      },
    ],
    [],
  );

  const table = useTable({
    data: rows,
    columns,
    getRowId: (row) => row.sku,
    fillColumn: "sku",
    enableSorting: false,
    enableSelection: vendorKey !== NEEDS_MAPPING_VENDOR_KEY,
    enablePagination: false,
  });

  const selectedCount = table.selection.selectedIds.size;
  const actionLabel =
    selectedCount > 0 ? `Build PO (${selectedCount})` : "Build PO";

  const draftSelected = useCallback(() => {
    if (selectedCount === 0 || isDrafting || vendorKey === NEEDS_MAPPING_VENDOR_KEY) {
      return;
    }
    setIsDrafting(true);
    setStatusMessage(null);
    const skus = [...table.selection.selectedIds];
    const { drafts, unmappedSkus } = prototypeDraftPurchaseOrders(
      PROTOTYPE_UNCOVERED_ROWS,
      skus,
    );
    table.selection.clear();

    if (drafts.length === 0) {
      setStatusMessage(
        unmappedSkus.length > 0
          ? `Skipped ${unmappedSkus.length} SKU(s) with no factory mapping.`
          : "No draft purchase order was created.",
      );
      setIsDrafting(false);
      return;
    }

    const draft = drafts[0];
    if (draft !== undefined) {
      router.push(`/purchasing/${draft.purchaseOrderId}`);
    }
    setIsDrafting(false);
  }, [isDrafting, router, selectedCount, table.selection, vendorKey]);

  if (summary === undefined) {
    return (
      <p className="text-body-sm text-fg-secondary">
        Factory not found.{" "}
        <Link
          href="/purchasing/uncovered/prototype"
          className="text-link hover:text-link-hover"
        >
          Back to factories
        </Link>
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <p className="text-body-sm text-fg-secondary">
        <Link
          href="/purchasing/uncovered/prototype"
          className="text-link hover:text-link-hover"
        >
          ← All factories
        </Link>
      </p>

      <header>
        <h2 className="text-heading-md font-semibold">{summary.name}</h2>
        <p className="page-description mt-2">
          {summary.productCount} product{summary.productCount === 1 ? "" : "s"} ready
          for a purchase order · {summary.totalUncovered} total uncovered units
        </p>
      </header>

      {vendorKey === NEEDS_MAPPING_VENDOR_KEY ? (
        <p className="text-body-sm text-fg-secondary" role="note">
          Assign a factory on the supplier detail page before these SKUs can be drafted
          onto a PO.
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
        {vendorKey !== NEEDS_MAPPING_VENDOR_KEY ? (
          <Table.BulkActions>
            <Button
              type="button"
              variant="primary"
              disabled={selectedCount === 0 || isDrafting}
              onClick={() => {
                draftSelected();
              }}
              data-testid="uncovered-prototype-build-po"
            >
              <FilePlus2 className="size-icon" aria-hidden />
              {actionLabel}
            </Button>
          </Table.BulkActions>
        ) : null}
      </Table>
    </div>
  );
}
