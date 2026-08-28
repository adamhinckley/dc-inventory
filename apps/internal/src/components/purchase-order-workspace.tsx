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
import { Button, Chip, Combobox, Input, Label, Table, useTable } from "@dc-inventory/ui";
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
import type { PurchaseOrderLineDraft } from "../lib/purchase-order-types";

function linesEqual(
  left: PurchaseOrderLineDraft[],
  right: PurchaseOrderLineDraft[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

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

  useEffect(() => {
    setSelectedSkus([]);
    setError(null);
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

  const submit = (event: FormEvent) => {
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
    <form className="flex flex-col gap-field-group" onSubmit={submit}>
      <div className="grid gap-field-group sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <div className="flex flex-col gap-2">
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
        </div>
        <div className="flex flex-col gap-2">
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
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={disabled || selectedSkus.length === 0}
        >
          {selectedSkus.length > 1 ? "Add lines" : "Add line"}
        </Button>
      </div>
      {error ? (
        <p className="text-body-sm text-error" role="alert">
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
  qtyDisabled = false,
}: {
  lines: PurchaseOrderLineDraft[];
  onUpdateQty: (sku: string, qtyRaw: string) => void;
  onRemoveLine: (sku: string) => void;
  qtyDisabled?: boolean;
}) {
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
        render: ({ record }: { record: PurchaseOrderLineDraft }) => (
          <Input
            type="number"
            min={1}
            step={1}
            className="max-w-28"
            value={String(record.qty)}
            onChange={(event) => onUpdateQty(record.sku, event.target.value)}
            disabled={qtyDisabled}
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
        render: ({ record }: { record: PurchaseOrderLineDraft }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemoveLine(record.sku)}
          >
            Remove
          </Button>
        ),
      },
    ],
    [onRemoveLine, onUpdateQty, qtyDisabled],
  );

  const table = useTable({
    data: lines,
    columns,
    getRowId: (row) => row.sku,
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
  isDraft,
}: {
  purchaseOrderId?: string;
  initialSupplierId: string | null;
  initialLines: PurchaseOrderLineDraft[];
  initialDocumentNumber?: string;
  isDraft: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isNew = !purchaseOrderId;

  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId);
  const [lines, setLines] = useState<PurchaseOrderLineDraft[]>(initialLines);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const lastSavedLinesRef = useRef(initialLines);
  const creatingRef = useRef(false);
  const replacingRef = useRef(false);
  const pendingReplaceLinesRef = useRef<PurchaseOrderLineDraft[] | null>(null);
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
            lines: nextLines,
          },
        });
        if (result.status === 201) {
          lastSavedLinesRef.current = nextLines;
          setSaveState("saved");
          await queryClient.invalidateQueries({
            queryKey: getListInternalPurchaseOrdersQueryKey(),
          });
          router.replace(`/purchasing/${result.data.id}`);
          return;
        }
        setSaveState("error");
        setActionError("Could not create draft purchase order.");
      } catch {
        setSaveState("error");
        setActionError("Could not create draft purchase order.");
      } finally {
        creatingRef.current = false;
        setIsCreating(false);
      }
    },
    [createMutation, purchaseOrderId, queryClient, router],
  );

  const persistReplace = useCallback(
    async (nextLines: PurchaseOrderLineDraft[]) => {
      if (!purchaseOrderId || nextLines.length === 0) {
        return;
      }
      if (linesEqual(nextLines, lastSavedLinesRef.current)) {
        return;
      }
      if (replacingRef.current) {
        pendingReplaceLinesRef.current = nextLines;
        return;
      }
      replacingRef.current = true;
      setSaveState("saving");
      setActionError(null);
      try {
        const result = await replaceMutation.mutateAsync({
          id: purchaseOrderId,
          data: { lines: nextLines },
        });
        if (result.status === 200) {
          lastSavedLinesRef.current = nextLines;
          setSaveState("saved");
          await queryClient.invalidateQueries({
            queryKey: getGetInternalPurchaseOrderQueryKey(purchaseOrderId),
          });
          await queryClient.invalidateQueries({
            queryKey: getListInternalPurchaseOrdersQueryKey(),
          });
          return;
        }
        setSaveState("error");
        setActionError("Autosave failed.");
      } catch {
        setSaveState("error");
        setActionError("Autosave failed.");
      } finally {
        replacingRef.current = false;
        const pending = pendingReplaceLinesRef.current;
        pendingReplaceLinesRef.current = null;
        if (
          pending !== null &&
          !linesEqual(pending, lastSavedLinesRef.current)
        ) {
          void persistReplace(pending);
        }
      }
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
    if (linesEqual(lines, lastSavedLinesRef.current)) {
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
  }, [isDraft, lines, persistReplace, purchaseOrderId]);

  const vendorLocked = Boolean(purchaseOrderId) || lines.length > 0;
  const workspaceLocked = isCreating;

  const addLines = useCallback(
    (next: PurchaseOrderLineDraft[]) => {
      if (creatingRef.current || workspaceLocked || next.length === 0) {
        return;
      }
      setActionError(null);
      const nextLines = [...lines, ...next];
      if (!purchaseOrderId && activeSupplierId) {
        creatingRef.current = true;
        setIsCreating(true);
        setLines(nextLines);
        void persistCreate(nextLines, activeSupplierId);
        return;
      }
      setLines(nextLines);
    },
    [activeSupplierId, lines, persistCreate, purchaseOrderId, workspaceLocked],
  );

  const updateLineQty = useCallback(
    (sku: string, qtyRaw: string) => {
      if (creatingRef.current || workspaceLocked) {
        return;
      }
      const qty = Number(qtyRaw);
      if (!Number.isInteger(qty) || qty <= 0) {
        return;
      }
      setLines((current) =>
        current.map((line) => (line.sku === sku ? { ...line, qty } : line)),
      );
    },
    [purchaseOrderId, workspaceLocked],
  );

  const removeLine = useCallback((sku: string) => {
    setLines((current) => {
      if (current.length <= 1) {
        setActionError("A draft PO must keep at least one line.");
        return current;
      }
      setActionError(null);
      return current.filter((line) => line.sku !== sku);
    });
  }, []);

  const flushAutosave = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    while (replacingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (
      purchaseOrderId &&
      lines.length > 0 &&
      !linesEqual(lines, lastSavedLinesRef.current)
    ) {
      await persistReplace(lines);
    }
  }, [lines, persistReplace, purchaseOrderId]);

  const finalize = useCallback(async () => {
    if (!purchaseOrderId) {
      return;
    }
    setActionError(null);
    await flushAutosave();
    if (!linesEqual(lines, lastSavedLinesRef.current)) {
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
    lines,
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
      await downloadPurchaseOrderXlsx(purchaseOrderId, initialDocumentNumber);
    } catch {
      setActionError("XLS download failed.");
    } finally {
      setExporting(false);
    }
  }, [initialDocumentNumber, purchaseOrderId]);

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
    <section className="flex flex-col gap-region">
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
                  !linesEqual(lines, lastSavedLinesRef.current)
                }
                onClick={() => void finalize()}
              >
                {confirmMutation.isPending ? "Finalizing…" : "Finalize"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid gap-field-group lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <div className="flex flex-col gap-field-group">
          <div className="flex flex-col gap-2">
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
          </div>
        </div>

        {activeSupplierId ? (
          <PurchaseOrderLineAdder
            key={activeSupplierId}
            supplierId={activeSupplierId}
            lines={lines}
            disabled={workspaceLocked}
            onAddLines={addLines}
          />
        ) : null}
      </div>

      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <PurchaseOrderLinesTable
        lines={lines}
        onUpdateQty={updateLineQty}
        onRemoveLine={removeLine}
        qtyDisabled={workspaceLocked}
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
      />
    );
  }

  return (
    <PurchaseOrderWorkspaceBody
      key={purchaseOrderId}
      purchaseOrderId={purchaseOrderId}
      initialSupplierId={po.supplierId}
      initialLines={po.lines.map((line) => ({
        sku: line.sku,
        name: line.name,
        qty: line.qty,
      }))}
      initialDocumentNumber={po.documentNumber}
      isDraft
    />
  );
}

function ConfirmedPurchaseOrderView({
  purchaseOrderId,
  documentNumber,
  status,
}: {
  purchaseOrderId: string;
  documentNumber: string;
  status: string;
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
