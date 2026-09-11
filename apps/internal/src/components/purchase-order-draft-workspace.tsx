"use client";

import {
  getGetInternalPurchaseOrderFactorySendQueryKey,
  getGetInternalPurchaseOrderQueryKey,
  getListInternalPurchaseOrdersQueryKey,
  getListInternalSupplierProductsQueryKey,
  useCancelInternalPurchaseOrder,
  useConfirmInternalPurchaseOrder,
  useGetInternalPurchaseOrderFactorySend,
  useCreateInternalPurchaseOrder,
  useListInternalSupplierProducts,
  useListInternalSuppliers,
  useReplaceInternalPurchaseOrderLines,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  Combobox,
  DateInput,
  DevComment,
  FieldRow,
  Input,
  Label,
  LabeledField,
  Table,
  useTable,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CircleCheck, Download, Package, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ProductCaseQtyDialog } from "./product-case-qty-dialog";
import { downloadPurchaseOrderXlsx } from "../lib/download-purchase-order-xlsx";
import {
  FACTORY_SEND_NO_CASE_QTY_LABEL,
  factorySendBlockedSkus,
  firstBlockedSku,
  missingCaseQtyRowElementId,
  type FactorySendRow,
} from "../lib/factory-send-table";
import {
  casesForDraftPoQty,
  draftLineFromVendorProduct,
  appendPurchaseOrderLine,
  coalescePurchaseOrderLines,
  purchaseOrderLineRowKey,
  purchaseOrderLineWritesEqual,
  purchaseOrderLinesSavedForConfirm,
  purchaseOrderWriteLines,
  removePurchaseOrderLinesByRowKeys,
} from "../lib/purchase-order-line-math";
import {
  formatSupplierProductCaseQtyDisplay,
  formatSupplierProductQtyDisplay,
} from "../lib/supplier-product-by-sku";
import { useSupplierProductsBySku } from "../lib/use-supplier-products-by-sku";
import {
  cancelPurchaseOrderErrorMessage,
  createPurchaseOrderErrorMessage,
  issuePurchaseOrderErrorMessage,
} from "../lib/purchase-order-action-errors";
import type { PurchaseOrderLineDraft } from "../lib/purchase-order-types";
import {
  DashboardTopbarPortal,
  MissingCaseQtyDownloadDialog,
  shouldWarnBeforeFactorySendDownload,
  SupplierName,
} from "./purchase-order-workspace-shared";

type PurchaseOrderLineRow = PurchaseOrderLineDraft & { rowIndex: number };

function PurchaseOrderLineAdder({
  supplierId,
  lines,
  disabled = false,
  onAddLines,
}: {
  supplierId: string | null;
  lines: PurchaseOrderLineDraft[];
  disabled?: boolean;
  onAddLines: (next: PurchaseOrderLineDraft[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const hasVendor = supplierId !== null;

  useEffect(() => {
    setError(null);
  }, [supplierId]);

  const supplierProductsParams = { page: 1, pageSize: 100 };
  const productsQuery = useListInternalSupplierProducts(
    supplierId ?? "",
    supplierProductsParams,
    {
      query: {
        enabled: hasVendor,
        queryKey: getListInternalSupplierProductsQueryKey(
          supplierId ?? "",
          supplierProductsParams,
        ),
      },
    },
  );

  const productOptions = useMemo(() => {
    const items =
      productsQuery.data?.status === 200 ? productsQuery.data.data.items : [];
    const taken = new Set(lines.map((line) => line.sku));
    return items
      .filter((product) => !taken.has(product.sku))
      .map((product) => ({
        value: product.sku,
        label: `${product.sku} — ${product.catalogName}`,
      }));
  }, [lines, productsQuery.data]);

  const productBySku = useMemo(() => {
    const items =
      productsQuery.data?.status === 200 ? productsQuery.data.data.items : [];
    return new Map(items.map((product) => [product.sku, product]));
  }, [productsQuery.data]);

  const addSku = (value: string | string[] | null) => {
    const skus = Array.isArray(value) ? value : value ? [value] : [];
    if (skus.length === 0) {
      return;
    }
    const taken = new Set(lines.map((line) => line.sku));
    const nextLines: PurchaseOrderLineDraft[] = [];
    for (const sku of skus) {
      if (taken.has(sku)) {
        continue;
      }
      const product = productBySku.get(sku);
      if (!product) {
        setError("A selected SKU is not on this vendor.");
        return;
      }
      nextLines.push(draftLineFromVendorProduct(product));
      taken.add(sku);
    }
    if (nextLines.length === 0) {
      return;
    }
    setError(null);
    onAddLines(nextLines);
  };

  return (
    <LabeledField className="min-w-56 flex-1">
      <Label htmlFor="po-product">Vendor product</Label>
      <Combobox
        id="po-product"
        multiple
        options={productOptions}
        value={[]}
        onChange={addSku}
        disabled={disabled || !hasVendor || productsQuery.isLoading}
        placeholder="Add a SKU"
      />
      {error ? (
        <p className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </LabeledField>
  );
}

function PurchaseOrderLineQtyInput({
  sku,
  qty,
  disabled,
  onCommit,
}: {
  sku: string;
  qty: number;
  disabled?: boolean;
  onCommit: (qty: number) => void;
}) {
  const [draft, setDraft] = useState(String(qty));

  useEffect(() => {
    setDraft(String(qty));
  }, [qty]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      className="max-w-28"
      value={draft}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw !== "" && !/^\d+$/.test(raw)) {
          return;
        }
        setDraft(raw);
        const next = Number(raw);
        if (Number.isInteger(next) && next > 0) {
          onCommit(next);
        }
      }}
      onBlur={() => {
        setDraft(String(qty));
      }}
      disabled={disabled}
      aria-label={`Quantity for ${sku}`}
    />
  );
}

function PurchaseOrderLinesTable({
  supplierId,
  lines,
  blockedSkus,
  purchaseOrderId,
  onUpdateQty,
  onRemoveSelected,
  disabled = false,
}: {
  supplierId: string | null;
  lines: PurchaseOrderLineDraft[];
  blockedSkus: ReadonlySet<string>;
  purchaseOrderId?: string;
  onUpdateQty: (index: number, qty: number) => void;
  onRemoveSelected: (keys: ReadonlySet<string>) => void;
  disabled?: boolean;
}) {
  const [caseQtySku, setCaseQtySku] = useState<string | null>(null);
  const lineSkus = useMemo(() => lines.map((line) => line.sku), [lines]);
  const { productBySku, statusBySku } = useSupplierProductsBySku(supplierId, lineSkus);
  const rows = useMemo<PurchaseOrderLineRow[]>(
    () => lines.map((line, rowIndex) => ({ ...line, rowIndex })),
    [lines],
  );

  const columns = useMemo(
    () => [
      {
        id: "sku",
        label: "SKU",
        sort: false as const,
        width: 180,
        render: ({ record }: { record: PurchaseOrderLineRow }) =>
          blockedSkus.has(record.sku) ? (
            <span
              id={missingCaseQtyRowElementId(record.sku)}
              className="flex flex-wrap items-center gap-tight"
            >
              <span>{record.sku}</span>
              <Chip
                icon={<Chip.Dot />}
                style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}
              >
                {FACTORY_SEND_NO_CASE_QTY_LABEL}
              </Chip>
            </span>
          ) : (
            record.sku
          ),
      },
      { id: "name", label: "Product", sort: false as const },
      {
        id: "onHand",
        label: "On hand",
        sort: false as const,
        width: 100,
        align: "right" as const,
        render: ({ record }: { record: PurchaseOrderLineRow }) =>
          formatSupplierProductQtyDisplay(
            statusBySku.get(record.sku) ?? "loading",
            productBySku.get(record.sku)?.qty.onHand,
          ),
      },
      {
        id: "preSold",
        label: "Pre-sold",
        sort: false as const,
        width: 100,
        align: "right" as const,
        render: ({ record }: { record: PurchaseOrderLineRow }) =>
          formatSupplierProductQtyDisplay(
            statusBySku.get(record.sku) ?? "loading",
            productBySku.get(record.sku)?.qty.committed,
          ),
      },
      {
        id: "need",
        label: "Need",
        sort: false as const,
        width: 100,
        align: "right" as const,
        render: ({ record }: { record: PurchaseOrderLineRow }) =>
          formatSupplierProductQtyDisplay(
            statusBySku.get(record.sku) ?? "loading",
            productBySku.get(record.sku)?.qty.toOrder,
          ),
      },
      {
        id: "caseQty",
        label: "Case qty",
        sort: false as const,
        width: 100,
        align: "right" as const,
        render: ({ record }: { record: PurchaseOrderLineRow }) =>
          formatSupplierProductCaseQtyDisplay(
            statusBySku.get(record.sku) ?? "loading",
            productBySku.get(record.sku)?.caseQty,
          ),
      },
      {
        id: "cases",
        label: "Cases",
        sort: false as const,
        width: 88,
        align: "right" as const,
        render: ({ record }: { record: PurchaseOrderLineRow }) => {
          const status = statusBySku.get(record.sku) ?? "loading";
          if (status !== "ready") {
            return "";
          }
          const cases = casesForDraftPoQty(
            record.qty,
            productBySku.get(record.sku)?.caseQty ?? null,
          );
          if (cases === null) {
            return "";
          }
          return Number.isInteger(cases) ? cases : cases.toFixed(2);
        },
      },
      {
        id: "caseQtyAction",
        label: "",
        sort: false as const,
        width: 180,
        truncate: false,
        align: "right" as const,
        render: ({ record }: { record: PurchaseOrderLineRow }) =>
          blockedSkus.has(record.sku) ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCaseQtySku(record.sku)}
              data-testid={`purchasing-po-line-enter-case-qty-${record.rowIndex}`}
            >
              <Package className="size-icon" aria-hidden />
              Enter Case Quantity
            </Button>
          ) : null,
      },
      {
        id: "qty",
        label: "Quantity",
        sort: false as const,
        width: 160,
        truncate: false,
        align: "right" as const,
        render: ({ record }: { record: PurchaseOrderLineRow }) => (
          <PurchaseOrderLineQtyInput
            sku={record.sku}
            qty={record.qty}
            disabled={disabled}
            onCommit={(qty) => onUpdateQty(record.rowIndex, qty)}
          />
        ),
      },
    ],
    [blockedSkus, disabled, onUpdateQty, productBySku, statusBySku],
  );

  const table = useTable({
    data: rows,
    columns,
    getRowId: (row) => purchaseOrderLineRowKey(row, row.rowIndex),
    getRowClassName: (row) =>
      blockedSkus.has(row.sku) ? "bg-warning/25" : undefined,
    fillColumn: "name",
    enableSorting: false,
    enableSelection: !disabled,
    enablePagination: false,
  });

  return (
    <>
      <Table
        sticky
        className="min-h-0 flex-1"
        table={table}
        emptyMessage="Add at least one line from the vendor catalog."
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
        <Table.BulkActions>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onRemoveSelected(table.selection.selectedIds);
              table.selection.clear();
            }}
          >
            <Trash2 className="size-icon-lg" aria-hidden />
            Remove Selected
          </Button>
        </Table.BulkActions>
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
    </>
  );
}

export function PurchaseOrderDraftWorkspace({
  purchaseOrderId,
  initialSupplierId,
  initialLines,
  initialDocumentNumber,
  initialShipDate,
  initialCancelDate,
}: {
  purchaseOrderId?: string;
  initialSupplierId: string | null;
  initialLines: PurchaseOrderLineDraft[];
  initialDocumentNumber?: string;
  initialShipDate: string | null;
  initialCancelDate: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isNew = !purchaseOrderId;

  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId);
  const [lines, setLines] = useState<PurchaseOrderLineDraft[]>(() =>
    coalescePurchaseOrderLines(initialLines),
  );
  const [shipDate, setShipDate] = useState<string | null>(initialShipDate);
  const [cancelDate, setCancelDate] = useState<string | null>(initialCancelDate);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [missingCaseQtyDownloadOpen, setMissingCaseQtyDownloadOpen] =
    useState(false);

  const factorySendQuery = useGetInternalPurchaseOrderFactorySend(
    purchaseOrderId ?? "",
    {
      query: {
        enabled: Boolean(purchaseOrderId),
        queryKey: getGetInternalPurchaseOrderFactorySendQueryKey(purchaseOrderId ?? ""),
      },
    },
  );
  const factorySendReady = factorySendQuery.data?.status === 200;
  const factorySendRows = useMemo(() => {
    if (!factorySendReady || factorySendQuery.data?.status !== 200) {
      return [] as FactorySendRow[];
    }
    return factorySendQuery.data.data.rows as FactorySendRow[];
  }, [factorySendQuery.data, factorySendReady]);
  const blockedSkus = useMemo(
    () => factorySendBlockedSkus(factorySendRows),
    [factorySendRows],
  );
  const missingCaseQtySku = factorySendReady ? firstBlockedSku(factorySendRows) : null;

  const lastSavedLinesRef = useRef(coalescePurchaseOrderLines(initialLines));
  const lastSavedDatesRef = useRef({
    shipDate: initialShipDate,
    cancelDate: initialCancelDate,
  });
  const lastPersistSucceededRef = useRef(true);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const datesRef = useRef({ shipDate, cancelDate });
  datesRef.current = { shipDate, cancelDate };
  const creatingRef = useRef(false);
  const persistChainRef = useRef(Promise.resolve(true));
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suppliersQuery = useListInternalSuppliers({ page: 1, pageSize: 100 });
  const supplierOptions = useMemo(() => {
    const items =
      suppliersQuery.data?.status === 200 ? suppliersQuery.data.data.items : [];
    return items.map((supplier) => ({
      value: supplier.id,
      label: `${supplier.vendorNumber} — ${supplier.name}`,
    }));
  }, [suppliersQuery.data]);

  const activeSupplierId = supplierId;
  const createMutation = useCreateInternalPurchaseOrder();
  const replaceMutation = useReplaceInternalPurchaseOrderLines();
  const confirmMutation = useConfirmInternalPurchaseOrder();
  const cancelMutation = useCancelInternalPurchaseOrder();

  const persistCreate = useCallback(
    async (nextLines: PurchaseOrderLineDraft[], vendorId: string) => {
      if (purchaseOrderId) {
        return;
      }
      if (!creatingRef.current) {
        creatingRef.current = true;
        setIsCreating(true);
      }
      setSaveState("saving");
      setActionError(null);
      try {
        const result = await createMutation.mutateAsync({
          data: {
            supplierId: vendorId,
            shipDate: datesRef.current.shipDate,
            cancelDate: datesRef.current.cancelDate,
            lines: purchaseOrderWriteLines(nextLines),
          },
        });
        if (result.status === 201) {
          lastSavedLinesRef.current = coalescePurchaseOrderLines(nextLines);
          lastSavedDatesRef.current = { ...datesRef.current };
          lastPersistSucceededRef.current = true;
          setSaveState("saved");
          await queryClient.invalidateQueries({
            queryKey: getListInternalPurchaseOrdersQueryKey(),
          });
          router.replace(`/procurement/purchase-orders/${result.data.id}`);
          return;
        }
        setSaveState("error");
        setActionError(createPurchaseOrderErrorMessage(result));
        lastPersistSucceededRef.current = false;
      } catch {
        setSaveState("error");
        setActionError("Could not create draft purchase order.");
        lastPersistSucceededRef.current = false;
      } finally {
        creatingRef.current = false;
        setIsCreating(false);
      }
    },
    [createMutation, purchaseOrderId, queryClient, router],
  );

  const persistReplace = useCallback(
    (nextLines: PurchaseOrderLineDraft[], force = false): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        if (!purchaseOrderId || nextLines.length === 0) {
          return false;
        }
        const payloadLines = coalescePurchaseOrderLines(nextLines);
        const payloadDates = { ...datesRef.current };
        if (
          !force &&
          purchaseOrderLineWritesEqual(payloadLines, lastSavedLinesRef.current) &&
          payloadDates.shipDate === lastSavedDatesRef.current.shipDate &&
          payloadDates.cancelDate === lastSavedDatesRef.current.cancelDate
        ) {
          lastPersistSucceededRef.current = true;
          return true;
        }
        setSaveState("saving");
        setActionError(null);
        try {
          const result = await replaceMutation.mutateAsync({
            id: purchaseOrderId,
            data: {
              shipDate: payloadDates.shipDate,
              cancelDate: payloadDates.cancelDate,
              lines: purchaseOrderWriteLines(payloadLines),
            },
          });
          if (result.status === 200) {
            lastSavedLinesRef.current = payloadLines;
            lastSavedDatesRef.current = payloadDates;
            lastPersistSucceededRef.current = true;
            setSaveState("saved");
            await queryClient.invalidateQueries({
              queryKey: getGetInternalPurchaseOrderQueryKey(purchaseOrderId),
            });
            await queryClient.invalidateQueries({
              queryKey: getListInternalPurchaseOrdersQueryKey(),
            });
            await queryClient.invalidateQueries({
              queryKey: getGetInternalPurchaseOrderFactorySendQueryKey(purchaseOrderId),
            });
            return true;
          }
          setSaveState("error");
          setActionError("Autosave failed.");
          lastPersistSucceededRef.current = false;
          return false;
        } catch {
          setSaveState("error");
          setActionError("Autosave failed.");
          lastPersistSucceededRef.current = false;
          return false;
        }
      };
      const next = persistChainRef.current.then(run, run);
      persistChainRef.current = next.then(
        () => true,
        () => false,
      );
      return next;
    },
    [purchaseOrderId, queryClient, replaceMutation],
  );

  useEffect(() => {
    if (!purchaseOrderId) {
      return;
    }
    if (lines.length === 0) {
      return;
    }
    if (
      purchaseOrderLineWritesEqual(lines, lastSavedLinesRef.current) &&
      shipDate === lastSavedDatesRef.current.shipDate &&
      cancelDate === lastSavedDatesRef.current.cancelDate
    ) {
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void persistReplace(lines);
    }, 600);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [cancelDate, lines, persistReplace, purchaseOrderId, shipDate]);

  const vendorLocked = Boolean(purchaseOrderId) || lines.length > 0;
  const workspaceLocked = isCreating;

  const addLines = useCallback(
    (next: PurchaseOrderLineDraft[]) => {
      if (creatingRef.current || workspaceLocked || next.length === 0) {
        return;
      }
      setActionError(null);
      const nextLines = next.reduce(
        (acc, line) => appendPurchaseOrderLine(acc, line),
        linesRef.current,
      );
      linesRef.current = nextLines;
      setLines(nextLines);
      if (!purchaseOrderId && activeSupplierId) {
        creatingRef.current = true;
        setIsCreating(true);
        void persistCreate(nextLines, activeSupplierId);
      }
    },
    [activeSupplierId, persistCreate, purchaseOrderId, workspaceLocked],
  );

  const updateLineQty = useCallback(
    (index: number, qty: number) => {
      if (creatingRef.current || workspaceLocked) {
        return;
      }
      setLines((current) => {
        const next = current.map((line, lineIndex) =>
          lineIndex === index ? { ...line, qty } : line,
        );
        linesRef.current = next;
        return next;
      });
    },
    [workspaceLocked],
  );

  const removeSelectedLines = useCallback((keys: ReadonlySet<string>) => {
    if (creatingRef.current || workspaceLocked || keys.size === 0) {
      return;
    }
    setLines((current) => {
      const next = removePurchaseOrderLinesByRowKeys(current, keys);
      if (next === null) {
        setActionError("A draft PO must keep at least one line.");
        return current;
      }
      setActionError(null);
      linesRef.current = next;
      return next;
    });
  }, [workspaceLocked]);

  const flushAutosave = useCallback(async (force = false) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await persistChainRef.current;
    if (!purchaseOrderId || linesRef.current.length === 0) {
      return lastPersistSucceededRef.current;
    }
    return persistReplace(linesRef.current, force);
  }, [persistReplace, purchaseOrderId]);

  const issuePo = useCallback(async () => {
    if (!purchaseOrderId) {
      return;
    }
    setActionError(null);
    const saved = await flushAutosave();
    if (
      !purchaseOrderLinesSavedForConfirm(
        linesRef.current,
        lastSavedLinesRef.current,
        saved,
      )
    ) {
      setActionError("Could not save latest lines before issuing.");
      return;
    }
    try {
      const result = await confirmMutation.mutateAsync({
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
      setActionError(issuePurchaseOrderErrorMessage(result));
    } catch {
      setActionError("Issue failed.");
    }
  }, [
    confirmMutation,
    flushAutosave,
    purchaseOrderId,
    queryClient,
    router,
  ]);

  const cancelPo = useCallback(async () => {
    if (!purchaseOrderId) {
      return;
    }
    setActionError(null);
    try {
      const result = await cancelMutation.mutateAsync({
        id: purchaseOrderId,
        data: { idempotencyKey: `cancel-${purchaseOrderId}` },
      });
      if (result.status !== 200) {
        setActionError(cancelPurchaseOrderErrorMessage(result));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: getGetInternalPurchaseOrderQueryKey(purchaseOrderId),
      });
      await queryClient.invalidateQueries({
        queryKey: getListInternalPurchaseOrdersQueryKey(),
      });
      router.push("/procurement/purchase-orders");
    } catch {
      setActionError("Could not cancel this purchase order.");
    }
  }, [cancelMutation, purchaseOrderId, queryClient, router]);

  const downloadXlsx = useCallback(async () => {
    if (!purchaseOrderId || !initialDocumentNumber) {
      return;
    }
    setExporting(true);
    setActionError(null);
    try {
      await flushAutosave();
      await downloadPurchaseOrderXlsx(purchaseOrderId, initialDocumentNumber);
    } catch {
      setActionError("XLS download failed.");
    } finally {
      setExporting(false);
    }
  }, [flushAutosave, initialDocumentNumber, purchaseOrderId]);

  const requestDownloadXlsx = useCallback(() => {
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
  }, [
    downloadXlsx,
    factorySendQuery.isFetching,
    factorySendReady,
    missingCaseQtySku,
  ]);

  const title = isNew
    ? "New draft purchase order"
    : (initialDocumentNumber ?? "Draft PO");
  useBreadcrumbLabel(purchaseOrderId, isNew ? undefined : title);
  const saveLabel =
    saveState === "saving"
      ? "Saving"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : "Autosave on";
  const saveChipColor =
    saveState === "saving"
      ? "var(--color-info)"
      : saveState === "saved"
        ? "var(--color-success)"
        : saveState === "error"
          ? "var(--color-error)"
          : "var(--color-fg-secondary)";

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-form-section">
      <DashboardTopbarPortal>
        <Chip
          busy={saveState === "saving"}
          icon={<Chip.Dot />}
          aria-live="polite"
          style={{ "--chip-color": saveChipColor } as CSSProperties}
        >
          {saveLabel}
        </Chip>
      </DashboardTopbarPortal>
      <header className="flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          <p className="page-description mt-2">
            Pick a vendor, add lines from that vendor&apos;s catalog, then issue or
            download XLS. Lines autosave after the first create.
          </p>
          {activeSupplierId ? <SupplierName supplierId={activeSupplierId} /> : null}
        </div>
        {purchaseOrderId ? (
          <div className="flex shrink-0 flex-wrap items-center gap-action">
            <Button
              type="button"
              variant="secondary"
              disabled={draftCancelDisabled(
                saveState,
                isCreating,
                confirmMutation.isPending,
                cancelMutation.isPending,
              )}
              onClick={() => void cancelPo()}
            >
              <Ban className="size-icon-lg" aria-hidden />
              {cancelMutation.isPending ? "Cancelling…" : "Cancel PO"}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={draftIssueDisabled(
                lines,
                lastSavedLinesRef.current,
                saveState,
                isCreating,
                confirmMutation.isPending,
                cancelMutation.isPending,
              )}
              onClick={() => void issuePo()}
            >
              <CircleCheck className="size-icon-lg" aria-hidden />
              {confirmMutation.isPending ? "Issuing…" : "Issue PO"}
            </Button>
          </div>
        ) : null}
      </header>

      <FieldRow>
        <LabeledField className="min-w-56 flex-1">
          <Label htmlFor="po-vendor">Vendor</Label>
          <Combobox
            id="po-vendor"
            options={supplierOptions}
            value={activeSupplierId}
            onChange={(value) => {
              if (!vendorLocked) {
                setSupplierId(typeof value === "string" ? value : null);
              }
            }}
            disabled={vendorLocked || suppliersQuery.isLoading}
            placeholder="Select vendor"
          />
        </LabeledField>

        <PurchaseOrderLineAdder
          supplierId={activeSupplierId}
          lines={lines}
          disabled={workspaceLocked}
          onAddLines={addLines}
        />
      </FieldRow>

      <FieldRow>
        <div className="relative flex flex-wrap items-end gap-field-group">
          <LabeledField className="min-w-56">
            <Label htmlFor="po-ship-date">Ship date</Label>
            <DateInput
              id="po-ship-date"
              value={shipDate}
              onChange={(value) => setShipDate(value.length === 0 ? null : value)}
              disabled={workspaceLocked}
              yearNavigation
              min="2020-01-01"
              max="2040-12-31"
              placeholder="Ship date"
            />
          </LabeledField>
          <LabeledField className="min-w-56">
            <Label htmlFor="po-cancel-date">Cancel date</Label>
            <DateInput
              id="po-cancel-date"
              value={cancelDate}
              onChange={(value) => setCancelDate(value.length === 0 ? null : value)}
              disabled={workspaceLocked}
              yearNavigation
              min="2020-01-01"
              max="2040-12-31"
              placeholder="Cancel date"
            />
          </LabeledField>
          <DevComment>
            Should these be required on every purchase order to be able to
            issue?
          </DevComment>
        </div>
        {purchaseOrderId ? (
          <div className="ml-auto flex flex-wrap items-end gap-field-group">
            <Button
              type="button"
              variant="secondary"
              disabled={
                exporting ||
                lines.length === 0 ||
                !factorySendReady ||
                factorySendQuery.isFetching
              }
              onClick={requestDownloadXlsx}
            >
              <Download className="size-icon-lg" aria-hidden />
              {exporting ? "Downloading…" : "Download XLS"}
            </Button>
          </div>
        ) : null}
      </FieldRow>

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

      <PurchaseOrderLinesTable
        supplierId={activeSupplierId}
        lines={lines}
        blockedSkus={blockedSkus}
        purchaseOrderId={purchaseOrderId}
        onUpdateQty={updateLineQty}
        onRemoveSelected={removeSelectedLines}
        disabled={workspaceLocked}
      />
    </section>
  );
}

export function draftCancelDisabled(
  saveState: "idle" | "saving" | "saved" | "error",
  isCreating: boolean,
  confirmPending: boolean,
  cancelPending: boolean,
): boolean {
  return saveState === "saving" || isCreating || confirmPending || cancelPending;
}

export function draftIssueDisabled(
  lines: readonly PurchaseOrderLineDraft[],
  lastSaved: readonly PurchaseOrderLineDraft[],
  saveState: "idle" | "saving" | "saved" | "error",
  isCreating: boolean,
  confirmPending: boolean,
  cancelPending = false,
): boolean {
  return (
    confirmPending ||
    cancelPending ||
    lines.length === 0 ||
    saveState === "saving" ||
    isCreating ||
    !purchaseOrderLineWritesEqual(lines, lastSaved)
  );
}
