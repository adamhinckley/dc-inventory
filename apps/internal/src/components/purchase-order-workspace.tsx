"use client";

import {
  getGetInternalPurchaseOrderQueryKey,
  getListInternalPurchaseOrdersQueryKey,
  useConfirmInternalPurchaseOrder,
  useCreateInternalPurchaseOrder,
  useGetInternalPurchaseOrder,
  useGetInternalSupplier,
  useListInternalSupplierProducts,
  useListInternalSuppliers,
  useReplaceInternalPurchaseOrderLines,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  Combobox,
  DateInput,
  FieldRow,
  Input,
  Label,
  LabeledField,
  Table,
  useTable,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { downloadPurchaseOrderXlsx } from "../lib/download-purchase-order-xlsx";
import { lineAdderSelectionForSupplier } from "../lib/purchase-order-line-adder";
import {
  appendPurchaseOrderLine,
  coalescePurchaseOrderLines,
  purchaseOrderLineRowKey,
  purchaseOrderLineWritesEqual,
  purchaseOrderLinesSavedForConfirm,
  purchaseOrderWriteLines,
} from "../lib/purchase-order-lines";
import type { PurchaseOrderLineDraft } from "../lib/purchase-order-types";

type PurchaseOrderLineRow = PurchaseOrderLineDraft & { rowIndex: number };

function SupplierName({ supplierId }: { supplierId: string }) {
  const supplierQuery = useGetInternalSupplier(supplierId);
  if (supplierQuery.data?.status !== 200) {
    return null;
  }
  return (
    <p className="text-body-sm text-fg-secondary mt-2">
      Vendor: {supplierQuery.data.data.name}
    </p>
  );
}

function PurchaseOrderLineAdder({
  supplierId,
  lines,
  disabled = false,
  onAddLines,
}: {
  supplierId: string;
  lines: PurchaseOrderLineDraft[];
  disabled?: boolean;
  onAddLines: (next: PurchaseOrderLineDraft[]) => void;
}) {
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [addQty, setAddQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const previousSupplierIdRef = useRef(supplierId);

  useEffect(() => {
    const previousSupplierId = previousSupplierIdRef.current;
    previousSupplierIdRef.current = supplierId;
    const next = lineAdderSelectionForSupplier(previousSupplierId, supplierId);
    if (!next) {
      return;
    }
    setSelectedSkus(next.selectedSkus);
    setError(next.error);
  }, [supplierId]);

  const productsQuery = useListInternalSupplierProducts(supplierId, {
    page: 1,
    pageSize: 100,
  });

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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (selectedSkus.length === 0) {
      setError("Pick at least one vendor product to add.");
      return;
    }
    const qty = Number(addQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    const taken = new Set(lines.map((line) => line.sku));
    const nextLines: PurchaseOrderLineDraft[] = [];
    for (const sku of selectedSkus) {
      if (taken.has(sku)) {
        continue;
      }
      const product = productBySku.get(sku);
      if (!product) {
        setError("A selected SKU is not on this vendor.");
        return;
      }
      nextLines.push({
        id: crypto.randomUUID(),
        sku: product.sku,
        name: product.catalogName,
        qty,
      });
    }
    if (nextLines.length === 0) {
      setError("Those SKUs are already on this PO.");
      return;
    }
    onAddLines(nextLines);
    setSelectedSkus([]);
    setAddQty("1");
  };

  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-end gap-field-group"
      onSubmit={submit}
    >
      <LabeledField className="min-w-56 flex-1">
        <Label htmlFor="po-product">Vendor product</Label>
        <Combobox
          id="po-product"
          multiple
          options={productOptions}
          value={selectedSkus}
          onChange={(value) =>
            setSelectedSkus(Array.isArray(value) ? value : [])
          }
          disabled={disabled || productsQuery.isLoading}
          placeholder="Select SKUs"
        />
      </LabeledField>
      <LabeledField className="w-24">
        <Label htmlFor="po-qty">Qty</Label>
        <Input
          id="po-qty"
          type="number"
          min={1}
          step={1}
          value={addQty}
          onChange={(event) => setAddQty(event.target.value)}
          disabled={disabled}
        />
      </LabeledField>
      <Button
        type="submit"
        variant="primary"
        className="shrink-0"
        disabled={disabled || selectedSkus.length === 0}
      >
        {selectedSkus.length > 1 ? "Add lines" : "Add line"}
      </Button>
      {error ? (
        <p className="basis-full text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function PurchaseOrderLinesTable({
  lines,
  onUpdateQty,
  onRemoveLine,
  disabled = false,
}: {
  lines: PurchaseOrderLineDraft[];
  onUpdateQty: (index: number, qtyRaw: string) => void;
  onRemoveLine: (index: number) => void;
  disabled?: boolean;
}) {
  const rows = useMemo<PurchaseOrderLineRow[]>(
    () => lines.map((line, rowIndex) => ({ ...line, rowIndex })),
    [lines],
  );

  const columns = useMemo(
    () => [
      { id: "sku", label: "SKU", sort: false as const, width: 140 },
      { id: "name", label: "Product", sort: false as const },
      {
        id: "qty",
        label: "Qty",
        sort: false as const,
        width: 160,
        truncate: false,
        render: ({ record }: { record: PurchaseOrderLineRow }) => (
          <Input
            type="number"
            min={1}
            step={1}
            className="max-w-28"
            value={String(record.qty)}
            onChange={(event) => onUpdateQty(record.rowIndex, event.target.value)}
            disabled={disabled}
            aria-label={`Quantity for ${record.sku}`}
          />
        ),
      },
      {
        id: "remove",
        label: "Actions",
        sort: false as const,
        width: 120,
        truncate: false,
        render: ({ record }: { record: PurchaseOrderLineRow }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onRemoveLine(record.rowIndex)}
          >
            Remove
          </Button>
        ),
      },
    ],
    [disabled, onRemoveLine, onUpdateQty],
  );

  const table = useTable({
    data: rows,
    columns,
    getRowId: (row) => purchaseOrderLineRowKey(row, row.rowIndex),
    fillColumn: "name",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  return (
    <Table
      table={table}
      emptyMessage="Add at least one line from the vendor catalog."
    >
      <Table.Header />
      <Table.Body />
      <Table.Empty />
    </Table>
  );
}

function PurchaseOrderWorkspaceBody({
  purchaseOrderId,
  initialSupplierId,
  initialLines,
  initialDocumentNumber,
  initialShipDate,
  initialCancelDate,
  isDraft,
}: {
  purchaseOrderId?: string;
  initialSupplierId: string | null;
  initialLines: PurchaseOrderLineDraft[];
  initialDocumentNumber?: string;
  initialShipDate: string | null;
  initialCancelDate: string | null;
  isDraft: boolean;
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
          router.replace(`/purchasing/${result.data.id}`);
          return;
        }
        setSaveState("error");
        setActionError("Could not create draft purchase order.");
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
    if (!purchaseOrderId || !isDraft) {
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
  }, [cancelDate, isDraft, lines, persistReplace, purchaseOrderId, shipDate]);

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
    (index: number, qtyRaw: string) => {
      if (creatingRef.current || workspaceLocked) {
        return;
      }
      const qty = Number(qtyRaw);
      if (!Number.isInteger(qty) || qty <= 0) {
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

  const removeLine = useCallback((index: number) => {
    if (creatingRef.current || workspaceLocked) {
      return;
    }
    setLines((current) => {
      if (current.length <= 1) {
        setActionError("A draft PO must keep at least one line.");
        return current;
      }
      setActionError(null);
      const next = current.filter((_, lineIndex) => lineIndex !== index);
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

  const finalize = useCallback(async () => {
    if (!purchaseOrderId) {
      return;
    }
    setActionError(null);
    const saved = await flushAutosave(true);
    if (
      !purchaseOrderLinesSavedForConfirm(
        linesRef.current,
        lastSavedLinesRef.current,
        saved,
      )
    ) {
      setActionError("Could not save latest lines before finalize.");
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
      setActionError("Finalize failed.");
    } catch {
      setActionError("Finalize failed.");
    }
  }, [
    confirmMutation,
    flushAutosave,
    purchaseOrderId,
    queryClient,
    router,
  ]);

  const downloadXlsx = useCallback(async () => {
    if (!purchaseOrderId || !initialDocumentNumber) {
      return;
    }
    setExporting(true);
    setActionError(null);
    try {
      await flushAutosave(true);
      await downloadPurchaseOrderXlsx(purchaseOrderId, initialDocumentNumber);
    } catch {
      setActionError("XLS download failed.");
    } finally {
      setExporting(false);
    }
  }, [flushAutosave, initialDocumentNumber, purchaseOrderId]);

  const title = isNew
    ? "New draft purchase order"
    : (initialDocumentNumber ?? "Draft PO");
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
    <section className="flex flex-col gap-form-section">
      <nav className="flex items-center justify-between gap-region">
        <p className="text-body-sm text-fg-secondary">
          <Link href="/purchasing" className="text-link hover:text-link-hover">
            Purchasing
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{isNew ? "New" : title}</span>
        </p>
        <Chip
          busy={saveState === "saving"}
          icon={<Chip.Dot />}
          aria-live="polite"
          style={{ "--chip-color": saveChipColor } as CSSProperties}
        >
          {saveLabel}
        </Chip>
      </nav>

      <header className="flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description mt-2">
            Pick a vendor, add lines from that vendor&apos;s catalog, then finalize or
            download XLS. Lines autosave after the first create.
          </p>
          {activeSupplierId ? <SupplierName supplierId={activeSupplierId} /> : null}
        </div>
        {purchaseOrderId ? (
          <div className="flex flex-wrap items-center gap-tight">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={exporting || lines.length === 0}
              onClick={() => void downloadXlsx()}
            >
              {exporting ? "Downloading…" : "Download XLS"}
            </Button>
            {isDraft ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={
                  confirmMutation.isPending ||
                  lines.length === 0 ||
                  saveState === "saving" ||
                  isCreating ||
                  !purchaseOrderLineWritesEqual(lines, lastSavedLinesRef.current)
                }
                onClick={() => void finalize()}
              >
                {confirmMutation.isPending ? "Finalizing…" : "Finalize"}
              </Button>
            ) : null}
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
            helperText={
              activeSupplierId ? undefined : "Select a vendor to add lines."
            }
          />
        </LabeledField>

        {activeSupplierId ? (
          <PurchaseOrderLineAdder
            key={activeSupplierId}
            supplierId={activeSupplierId}
            lines={lines}
            disabled={workspaceLocked}
            onAddLines={addLines}
          />
        ) : null}
      </FieldRow>

      <FieldRow>
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
      </FieldRow>

      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <PurchaseOrderLinesTable
        lines={lines}
        onUpdateQty={updateLineQty}
        onRemoveLine={removeLine}
        disabled={workspaceLocked}
      />
    </section>
  );
}

export function PurchaseOrderWorkspace({
  purchaseOrderId,
}: {
  purchaseOrderId?: string;
}) {
  const isNew = !purchaseOrderId;

  if (isNew) {
    return (
      <PurchaseOrderWorkspaceBody
        initialSupplierId={null}
        initialLines={[]}
        initialShipDate={null}
        initialCancelDate={null}
        isDraft
      />
    );
  }

  return <PurchaseOrderEditWorkspace purchaseOrderId={purchaseOrderId} />;
}

function PurchaseOrderEditWorkspace({
  purchaseOrderId,
}: {
  purchaseOrderId: string;
}) {
  const poQuery = useGetInternalPurchaseOrder(purchaseOrderId);
  const po = poQuery.data?.status === 200 ? poQuery.data.data : undefined;

  if (poQuery.isLoading) {
    return <p className="text-body-sm text-fg-secondary">Loading purchase order…</p>;
  }

  if (poQuery.isError || !po) {
    return (
      <p className="text-body-sm text-error" role="alert">
        Could not load purchase order.
      </p>
    );
  }

  if (po.status !== "draft") {
    return (
      <ConfirmedPurchaseOrderView
        purchaseOrderId={purchaseOrderId}
        documentNumber={po.documentNumber}
        status={po.status}
        shipDate={po.shipDate}
        cancelDate={po.cancelDate}
      />
    );
  }

  return (
    <PurchaseOrderWorkspaceBody
      key={purchaseOrderId}
      purchaseOrderId={purchaseOrderId}
      initialSupplierId={po.supplierId}
      initialLines={coalescePurchaseOrderLines(
        po.lines.map((line) => ({
          id: line.id,
          sku: line.sku,
          name: line.name,
          qty: line.qty,
        })),
      )}
      initialDocumentNumber={po.documentNumber}
      initialShipDate={po.shipDate}
      initialCancelDate={po.cancelDate}
      isDraft
    />
  );
}

function ConfirmedPurchaseOrderView({
  purchaseOrderId,
  documentNumber,
  status,
  shipDate,
  cancelDate,
}: {
  purchaseOrderId: string;
  documentNumber: string;
  status: string;
  shipDate: string | null;
  cancelDate: string | null;
}) {
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  return (
    <section className="flex flex-col gap-region">
      <nav className="text-body-sm text-fg-secondary">
        <Link href="/purchasing" className="text-link hover:text-link-hover">
          Purchasing
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{documentNumber}</span>
      </nav>
      <header>
        <h1 className="page-title">{documentNumber}</h1>
        <p className="page-description mt-2">
          This purchase order is {status} and can no longer be edited here.
        </p>
        <p className="text-body-sm text-fg-secondary mt-2">
          Ship date: {shipDate ?? "—"} · Cancel date: {cancelDate ?? "—"}
        </p>
      </header>
      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={exporting}
          onClick={() => void downloadXlsx()}
        >
          {exporting ? "Downloading…" : "Download XLS"}
        </Button>
      </div>
    </section>
  );
}
