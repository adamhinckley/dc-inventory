"use client";

import {
  getGetInternalPurchaseOrderQueryKey,
  getListInternalPurchaseOrdersQueryKey,
  useGetInternalPurchaseOrderFactorySend,
  useUnconfirmInternalPurchaseOrder,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  Table,
  useTable,
} from "@dc-inventory/ui";
import { Download, Package, Undo2 } from "lucide-react";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";
import { useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { unissuePurchaseOrderErrorMessage } from "../lib/purchase-order-action-errors";
import { purchaseOrderStatusPresentation } from "../lib/purchase-order-status-chip";
import { ProductCaseQtyDialog } from "./product-case-qty-dialog";
import { downloadPurchaseOrderXlsx } from "../lib/download-purchase-order-xlsx";
import {
  FACTORY_SEND_NO_CASE_QTY_LABEL,
  factorySendRowBlocksCartons,
  factorySendRowClassName,
  factorySendRowId,
  factorySendTableColumns,
  firstBlockedSku,
  formatFactorySendCell,
  missingCaseQtyRowElementId,
  type FactorySendRow,
} from "../lib/factory-send-table";
import {
  MissingCaseQtyDownloadDialog,
  shouldWarnBeforeFactorySendDownload,
  SupplierName,
} from "./purchase-order-workspace-shared";

function FactorySendLinesTable({ purchaseOrderId }: { purchaseOrderId: string }) {
  const [caseQtySku, setCaseQtySku] = useState<string | null>(null);
  const factorySendQuery = useGetInternalPurchaseOrderFactorySend(purchaseOrderId);
  const sheet =
    factorySendQuery.data?.status === 200 ? factorySendQuery.data.data : undefined;
  const rows = useMemo<FactorySendRow[]>(
    () => (sheet?.rows ?? []) as FactorySendRow[],
    [sheet?.rows],
  );
  const columns = useMemo(() => {
    const baseColumns = factorySendTableColumns(sheet?.columns ?? []).map((column) =>
      column.id !== "mat_num"
        ? column
        : {
            ...column,
            render: ({ record }: { record: FactorySendRow }) => {
              const sku = String(record.mat_num ?? "");
              if (!factorySendRowBlocksCartons(record)) {
                return formatFactorySendCell(record.mat_num);
              }
              return (
                <span className="flex flex-wrap items-center gap-tight">
                  <span>{sku}</span>
                  <Chip
                    id={missingCaseQtyRowElementId(sku)}
                    icon={<Chip.Dot />}
                    style={
                      { "--chip-color": "var(--color-warning)" } as CSSProperties
                    }
                  >
                    {FACTORY_SEND_NO_CASE_QTY_LABEL}
                  </Chip>
                </span>
              );
            },
          },
    );
    const totCartonsIndex = baseColumns.findIndex((column) => column.id === "tot_cartons");
    if (totCartonsIndex === -1) {
      return baseColumns;
    }
    const caseQtyActionColumn = {
      id: "caseQtyAction",
      label: "",
      sort: false as const,
      width: 180,
      truncate: false,
      align: "right" as const,
      render: ({ record }: { record: FactorySendRow }) => {
        const sku = String(record.mat_num ?? "");
        if (!factorySendRowBlocksCartons(record) || sku.length === 0) {
          return null;
        }
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCaseQtySku(sku)}
            data-testid={`purchasing-factory-send-enter-case-qty-${sku}`}
          >
            <Package className="size-icon" aria-hidden />
            Enter Case Quantity
          </Button>
        );
      },
    };
    return [
      ...baseColumns.slice(0, totCartonsIndex),
      caseQtyActionColumn,
      ...baseColumns.slice(totCartonsIndex),
    ];
  }, [sheet?.columns]);

  const table = useTable({
    data: rows,
    columns,
    getRowId: factorySendRowId,
    getRowClassName: factorySendRowClassName,
    fillColumn: "description",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  const emptyMessage = factorySendQuery.isLoading
    ? "Loading mill table…"
    : factorySendQuery.isError || !sheet
      ? "Could not load the mill table."
      : "This purchase order has no lines.";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-tight">
      <Table sticky table={table} emptyMessage={emptyMessage}>
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>
      {caseQtySku ? (
        <ProductCaseQtyDialog
          sku={caseQtySku}
          purchaseOrderId={purchaseOrderId}
          open
          onOpenChange={(open) => {
            if (!open) {
              setCaseQtySku(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

export function PurchaseOrderFactorySendWorkspace({
  purchaseOrderId,
  documentNumber,
  status,
  supplierId,
  shipDate,
  cancelDate,
  lines,
}: {
  purchaseOrderId: string;
  documentNumber: string;
  status: string;
  supplierId: string;
  shipDate: string | null;
  cancelDate: string | null;
  lines: readonly { receivedQty: number }[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const unconfirmMutation = useUnconfirmInternalPurchaseOrder();
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [missingCaseQtyDownloadOpen, setMissingCaseQtyDownloadOpen] =
    useState(false);
  const factorySendQuery = useGetInternalPurchaseOrderFactorySend(purchaseOrderId);
  const factorySendReady = factorySendQuery.data?.status === 200;
  const factorySendRows = useMemo(() => {
    if (!factorySendReady || factorySendQuery.data?.status !== 200) {
      return [] as FactorySendRow[];
    }
    return factorySendQuery.data.data.rows as FactorySendRow[];
  }, [factorySendQuery.data, factorySendReady]);
  const missingCaseQtySku = factorySendReady ? firstBlockedSku(factorySendRows) : null;
  const totalReceived = useMemo(
    () => lines.reduce((sum, line) => sum + line.receivedQty, 0),
    [lines],
  );
  const canUnissue = status === "confirmed" && totalReceived === 0;
  const statusPresentation = purchaseOrderStatusPresentation(status);

  useBreadcrumbLabel(purchaseOrderId, documentNumber);

  const downloadXlsx = async () => {
    setExporting(true);
    setActionError(null);
    try {
      await downloadPurchaseOrderXlsx(purchaseOrderId, documentNumber);
    } catch {
      setActionError("XLS download failed.");
    } finally {
      setExporting(false);
    }
  };

  const requestDownloadXlsx = () => {
    if (!factorySendReady || factorySendQuery.isFetching) {
      return;
    }
    if (
      shouldWarnBeforeFactorySendDownload(
        factorySendReady,
        factorySendQuery.isFetching,
        missingCaseQtySku,
      )
    ) {
      setMissingCaseQtyDownloadOpen(true);
      return;
    }
    void downloadXlsx();
  };

  const unissuePo = async () => {
    if (!canUnissue) {
      return;
    }
    setActionError(null);
    try {
      const result = await unconfirmMutation.mutateAsync({
        id: purchaseOrderId,
        data: { idempotencyKey: crypto.randomUUID() },
      });
      if (result.status === 200) {
        await queryClient.invalidateQueries({
          queryKey: getGetInternalPurchaseOrderQueryKey(purchaseOrderId),
        });
        await queryClient.invalidateQueries({
          queryKey: getListInternalPurchaseOrdersQueryKey(),
        });
        router.refresh();
        return;
      }
      setActionError(unissuePurchaseOrderErrorMessage(result));
    } catch {
      setActionError("Unissue failed.");
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <header className="flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-tight">
            <h1 className="page-title">{documentNumber}</h1>
            {statusPresentation ? (
              <Chip
                icon={<Chip.Dot />}
                style={
                  { "--chip-color": statusPresentation.color } as CSSProperties
                }
              >
                {statusPresentation.label}
              </Chip>
            ) : null}
          </div>
          <p className="page-description mt-2">
            {status === "confirmed"
              ? "This purchase order has been issued and can no longer be edited here."
              : `This purchase order is ${status} and can no longer be edited here.`}
          </p>
          <SupplierName supplierId={supplierId} />
          <p className="text-body-sm text-fg-secondary mt-2">
            Ship date: {shipDate ?? "—"} · Cancel date: {cancelDate ?? "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-tight">
          {canUnissue ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={unconfirmMutation.isPending}
              onClick={() => void unissuePo()}
            >
              <Undo2 className="size-icon-lg" aria-hidden />
              {unconfirmMutation.isPending ? "Unissuing…" : "Unissue PO"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={
              exporting || !factorySendReady || factorySendQuery.isFetching
            }
            onClick={requestDownloadXlsx}
          >
            <Download className="size-icon-lg" aria-hidden />
            {exporting ? "Downloading…" : "Download XLS"}
          </Button>
        </div>
      </header>
      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {missingCaseQtySku ? (
        <MissingCaseQtyDownloadDialog
          open={missingCaseQtyDownloadOpen}
          sku={missingCaseQtySku}
          onOpenChange={setMissingCaseQtyDownloadOpen}
          onProceed={() => void downloadXlsx()}
        />
      ) : null}
      <FactorySendLinesTable purchaseOrderId={purchaseOrderId} />
    </section>
  );
}