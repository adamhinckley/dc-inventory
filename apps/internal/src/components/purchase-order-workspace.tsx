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
import { Button, Combobox, FieldRow, Input, Label, LabeledField } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { downloadPurchaseOrderXlsx } from "../lib/download-purchase-order-xlsx";
import {
  appendPurchaseOrderLine,
  coalescePurchaseOrderLines,
  purchaseOrderLineRowKey,
  purchaseOrderLineWritesEqual,
  purchaseOrderLinesSavedForConfirm,
  purchaseOrderWriteLines,
} from "../lib/purchase-order-lines";
import type { PurchaseOrderLineDraft } from "../lib/purchase-order-types";

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
  disabled = false,
  onAddLine,
}: {
  supplierId: string;
  disabled?: boolean;
  onAddLine: (line: PurchaseOrderLineDraft) => void;
}) {
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [addQty, setAddQty] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const productsQuery = useListInternalSupplierProducts(supplierId, {
    page: 1,
    pageSize: 100,
  });

  const productOptions = useMemo(() => {
    const items =
      productsQuery.data?.status === 200 ? productsQuery.data.data.items : [];
    return items.map((product) => ({
      value: product.sku,
      label: `${product.sku} — ${product.catalogName}`,
    }));
  }, [productsQuery.data]);

  const productBySku = useMemo(() => {
    const items =
      productsQuery.data?.status === 200 ? productsQuery.data.data.items : [];
    return new Map(items.map((product) => [product.sku, product]));
  }, [productsQuery.data]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!selectedSku) {
      setError("Pick a vendor product to add.");
      return;
    }
    const product = productBySku.get(selectedSku);
    if (!product) {
      setError("Selected SKU is not on this vendor.");
      return;
    }
    const qty = Number(addQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    onAddLine({
      id: crypto.randomUUID(),
      sku: product.sku,
      name: product.catalogName,
      qty,
    });
    setSelectedSku(null);
    setAddQty("1");
  };

  return (
    <form className="flex min-w-0 flex-1 flex-wrap items-end gap-field-group" onSubmit={submit}>
      <LabeledField className="min-w-56 flex-1">
        <Label htmlFor="po-product">Vendor product</Label>
        <Combobox
          id="po-product"
          options={productOptions}
          value={selectedSku}
          onChange={(value) =>
            setSelectedSku(typeof value === "string" ? value : null)
          }
          disabled={disabled || productsQuery.isLoading}
          placeholder="Select SKU"
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
      <Button type="submit" variant="primary" className="shrink-0" disabled={disabled}>
        Add line
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
  qtyDisabled = false,
}: {
  lines: PurchaseOrderLineDraft[];
  onUpdateQty: (index: number, qtyRaw: string) => void;
  onRemoveLine: (index: number) => void;
  qtyDisabled?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-interactable border border-border">
      <table className="w-full min-w-[36rem] text-left text-body-sm">
        <thead className="border-b border-border bg-surface-muted text-label text-fg-secondary">
          <tr>
            <th className="px-table-cell-x py-table-cell-y">SKU</th>
            <th className="px-table-cell-x py-table-cell-y">Product</th>
            <th className="px-table-cell-x py-table-cell-y">Qty</th>
            <th className="px-table-cell-x py-table-cell-y">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td
                className="px-table-cell-x py-table-cell-y text-fg-secondary"
                colSpan={4}
              >
                Add at least one line from the vendor catalog.
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr
                key={purchaseOrderLineRowKey(line, index)}
                className="border-b border-border last:border-0"
              >
                <td className="px-table-cell-x py-table-cell-y tabular-nums">
                  {line.sku}
                </td>
                <td className="px-table-cell-x py-table-cell-y">{line.name}</td>
                <td className="px-table-cell-x py-table-cell-y">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      className="max-w-28"
                      value={String(line.qty)}
                      onChange={(event) => onUpdateQty(index, event.target.value)}
                      disabled={qtyDisabled}
                      aria-label={`Quantity for ${line.sku}`}
                    />
                </td>
                <td className="px-table-cell-x py-table-cell-y">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveLine(index)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
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
  const [lines, setLines] = useState<PurchaseOrderLineDraft[]>(() =>
    coalescePurchaseOrderLines(initialLines),
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const lastSavedLinesRef = useRef(coalescePurchaseOrderLines(initialLines));
  const lastPersistSucceededRef = useRef(true);
  const linesRef = useRef(lines);
  linesRef.current = lines;
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
            lines: purchaseOrderWriteLines(nextLines),
          },
        });
        if (result.status === 201) {
          lastSavedLinesRef.current = coalescePurchaseOrderLines(nextLines);
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
        if (
          !force &&
          purchaseOrderLineWritesEqual(payloadLines, lastSavedLinesRef.current)
        ) {
          lastPersistSucceededRef.current = true;
          return true;
        }
        setSaveState("saving");
        setActionError(null);
        try {
          const result = await replaceMutation.mutateAsync({
            id: purchaseOrderId,
            data: { lines: purchaseOrderWriteLines(payloadLines) },
          });
          if (result.status === 200) {
            lastSavedLinesRef.current = payloadLines;
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
    if (purchaseOrderLineWritesEqual(lines, lastSavedLinesRef.current)) {
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

  const addLine = useCallback(
    (line: PurchaseOrderLineDraft) => {
      if (creatingRef.current || workspaceLocked) {
        return;
      }
      setActionError(null);
      const nextLines = appendPurchaseOrderLine(linesRef.current, line);
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
  }, []);

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
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : "Autosave on";

  return (
    <section className="flex flex-col gap-form-section">
      <nav className="text-body-sm text-fg-secondary">
        <Link href="/purchasing" className="text-link hover:text-link-hover">
          Purchasing
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{isNew ? "New" : title}</span>
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
        <div className="flex flex-wrap items-center gap-tight">
          <span className="text-body-sm text-fg-secondary" aria-live="polite">
            {saveLabel}
          </span>
          {purchaseOrderId ? (
            <>
              <Button
                type="button"
                variant="secondary"
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
            </>
          ) : null}
        </div>
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

        {activeSupplierId ? (
          <PurchaseOrderLineAdder
            supplierId={activeSupplierId}
            disabled={workspaceLocked}
            onAddLine={addLine}
          />
        ) : (
          <p className="text-body-sm text-fg-secondary">
            Select a vendor to add lines.
          </p>
        )}
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
      initialLines={coalescePurchaseOrderLines(
        po.lines.map((line) => ({
          id: line.id,
          sku: line.sku,
          name: line.name,
          qty: line.qty,
        })),
      )}
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
          variant="secondary"
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
