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
import { UncoveredBatchDraftModal } from "./uncovered-batch-draft-modal";
import {
  NEEDS_MAPPING_VENDOR_KEY,
  PROTOTYPE_UNCOVERED_ROWS,
  prototypeDraftPurchaseOrders,
  skusForVendorKeys,
  summarizeUncoveredByVendor,
  type PrototypeDraftResult,
  type PrototypeVendorSummaryRow,
} from "./uncovered-vendor-prototype-mock";

function VendorNameCell({ row }: { row: PrototypeVendorSummaryRow }) {
  if (row.needsAttention) {
    return (
      <Link
        href={`/purchasing/uncovered/prototype/${row.key}`}
        className="text-link hover:text-link-hover inline-flex min-w-0 items-center gap-field"
      >
        <Chip
          style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}
        >
          {row.name}
        </Chip>
      </Link>
    );
  }

  return (
    <Link
      href={`/purchasing/uncovered/prototype/${row.key}`}
      className="text-link hover:text-link-hover block min-w-0 truncate font-medium"
    >
      {row.name}
    </Link>
  );
}

export function UncoveredVendorSummary() {
  const router = useRouter();
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<readonly PrototypeDraftResult[]>(
    [],
  );
  const [batchUnmapped, setBatchUnmapped] = useState<readonly string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);

  const rows = useMemo(() => [...summarizeUncoveredByVendor()], []);

  const columns = useMemo<TableColumnDef<PrototypeVendorSummaryRow>[]>(
    () => [
      {
        id: "name",
        label: "Factory",
        sort: false,
        align: "left",
        fill: true,
        truncate: true,
        render: ({ record }) => <VendorNameCell row={record} />,
      },
      {
        id: "vendorNumber",
        label: "Factory #",
        sort: false,
        align: "left",
        render: ({ record }) => record.vendorNumber,
      },
      {
        id: "productCount",
        label: "Products",
        sort: false,
        align: "right",
        render: ({ record }) => String(record.productCount),
      },
      {
        id: "totalUncovered",
        label: "Total uncovered",
        sort: false,
        align: "right",
        render: ({ record }) => String(record.totalUncovered),
      },
    ],
    [],
  );

  const table = useTable({
    data: rows,
    columns,
    getRowId: (row) => row.key,
    fillColumn: "name",
    enableSorting: false,
    enableSelection: true,
    enablePagination: false,
  });

  const selectedCount = table.selection.selectedIds.size;
  const draftableKeys = [...table.selection.selectedIds].filter(
    (key) => key !== NEEDS_MAPPING_VENDOR_KEY,
  );
  const actionLabel =
    selectedCount > 0 ? `Draft POs (${draftableKeys.length})` : "Draft POs";

  const draftSelected = useCallback(() => {
    if (draftableKeys.length === 0 || isDrafting) {
      return;
    }
    setIsDrafting(true);
    setStatusMessage(null);
    const skus = skusForVendorKeys(draftableKeys);
    const { drafts, unmappedSkus } = prototypeDraftPurchaseOrders(
      PROTOTYPE_UNCOVERED_ROWS,
      skus,
    );
    table.selection.clear();

    if (drafts.length === 0) {
      setStatusMessage("No draft purchase orders were created.");
      setIsDrafting(false);
      return;
    }

    if (drafts.length === 1 && unmappedSkus.length === 0) {
      const draft = drafts[0];
      if (draft !== undefined) {
        router.push(`/purchasing/${draft.purchaseOrderId}`);
      }
      setIsDrafting(false);
      return;
    }

    setBatchDrafts(drafts);
    setBatchUnmapped(unmappedSkus);
    setBatchModalOpen(true);
    setIsDrafting(false);
  }, [draftableKeys, isDrafting, router, table.selection]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <div
        className="rounded-section border border-warning/40 bg-warning/10 px-item-x py-item-y text-body-sm"
        role="note"
      >
        <strong>Prototype</strong> — one row per factory with product count. Click a
        factory to review SKUs and build a PO. Select multiple factories to draft POs in
        bulk.
      </div>

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
            disabled={draftableKeys.length === 0 || isDrafting}
            onClick={() => {
              draftSelected();
            }}
            data-testid="uncovered-prototype-draft-vendors"
          >
            <FilePlus2 className="size-icon" aria-hidden />
            {actionLabel}
          </Button>
        </Table.BulkActions>
      </Table>

      <UncoveredBatchDraftModal
        open={batchModalOpen}
        drafts={batchDrafts}
        unmappedSkus={batchUnmapped}
        onOpenChange={setBatchModalOpen}
      />
    </div>
  );
}
