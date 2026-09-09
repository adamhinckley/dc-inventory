"use client";

import {
  getGetInternalSalesOrderQueryKey,
  getListInternalProductsQueryKey,
  getListInternalSalesOrdersQueryKey,
  useCancelInternalSalesOrder,
  useConfirmInternalSalesOrder,
  useGetInternalCustomer,
  useListInternalCustomerShipTos,
  useListInternalProducts,
  useReplaceInternalSalesOrderLines,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  Combobox,
  Dialog,
  FieldRow,
  formatMoneyMinorUnits,
  Input,
  Label,
  LabeledField,
  Table,
  TextInput,
  useTable,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CircleCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  cancelSalesOrderErrorMessage,
  confirmSalesOrderErrorMessage,
  formatCreditExceededMessage,
  isCreditExceededConfirmError,
  replaceSalesOrderLinesErrorMessage,
} from "../lib/sales-order-action-errors";
import {
  lineSubtotalCents,
  salesOrderCancelDisabled,
  salesOrderCatalogLookupPending,
  salesOrderConfirmDisabled,
  salesOrderLineRowKey,
  salesOrderLinesResolved,
  salesOrderLineWritesEqual,
  salesOrderSubtotalCents,
  salesOrderWriteLines,
} from "../lib/sales-order-line-math";
import type { SalesOrderLineDraft } from "../lib/sales-order-types";
import { useCatalogProductsBySku } from "../lib/use-catalog-products-by-sku";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";
import { DashboardTopbarPortal } from "./purchase-order-workspace-shared";

type SalesOrderLineRow = SalesOrderLineDraft & { rowIndex: number };

type SalesOrderLineResponse = {
  id: string;
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  currency: string;
};

function CustomerName({ customerId }: { customerId: string }) {
  const customerQuery = useGetInternalCustomer(customerId);
  if (customerQuery.data?.status !== 200) {
    return null;
  }
  return (
    <p className="text-body-sm text-fg-secondary mt-2">
      Customer: {customerQuery.data.data.name}
    </p>
  );
}

function draftLinesFromOrder(lines: readonly SalesOrderLineResponse[]): SalesOrderLineDraft[] {
  return lines.map((line) => ({
    rowKey: salesOrderLineRowKey(line),
    productId: "",
    sku: line.sku,
    name: line.name,
    qty: line.qty,
    unitPriceCents: line.unitPriceCents,
    currency: line.currency,
  }));
}

function SalesOrderProductSearchAdder({
  lines,
  disabled = false,
  onAddLines,
}: {
  lines: SalesOrderLineDraft[];
  disabled?: boolean;
  onAddLines: (next: SalesOrderLineDraft[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const searchParams = useMemo(
    () => ({
      q: debouncedSearch,
      page: 1,
      pageSize: 25,
    }),
    [debouncedSearch],
  );
  const searchQuery = useListInternalProducts(searchParams, {
    query: {
      enabled: debouncedSearch.length >= 2,
      queryKey: getListInternalProductsQueryKey(searchParams),
    },
  });
  const searchItems =
    searchQuery.data?.status === 200 ? searchQuery.data.data.items : [];

  const productOptions = useMemo(() => {
    const taken = new Set(lines.map((line) => line.sku));
    return searchItems
      .filter((product) => !taken.has(product.sku) && !product.inactive)
      .map((product) => ({
        value: product.sku,
        label: `${product.sku} — ${product.name}`,
      }));
  }, [lines, searchItems]);

  const productBySku = useMemo(
    () => new Map(searchItems.map((product) => [product.sku, product])),
    [searchItems],
  );

  const addSku = (value: string | string[] | null) => {
    const skus = Array.isArray(value) ? value : value ? [value] : [];
    if (skus.length === 0) {
      return;
    }
    const taken = new Set(lines.map((line) => line.sku));
    const nextLines: SalesOrderLineDraft[] = [];
    for (const sku of skus) {
      if (taken.has(sku)) {
        continue;
      }
      const product = productBySku.get(sku);
      if (!product) {
        setError("A selected SKU is not in the catalog.");
        return;
      }
      nextLines.push({
        rowKey: sku,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty: 1,
        unitPriceCents: product.memberPrice,
        currency: product.currency,
      });
    }
    if (nextLines.length === 0) {
      return;
    }
    setError(null);
    onAddLines(nextLines);
  };

  return (
    <FieldRow>
      <LabeledField className="w-52 shrink-0">
        <Label htmlFor="sales-order-product-search">Find Product</Label>
        <TextInput
          id="sales-order-product-search"
          density="compact"
          value={search}
          placeholder="Search SKU or name"
          disabled={disabled}
          onChange={setSearch}
        />
      </LabeledField>
      <LabeledField className="min-w-56 flex-1">
        <Label htmlFor="sales-order-product">Catalog Product</Label>
        <Combobox
          id="sales-order-product"
          options={productOptions}
          value={[]}
          onChange={addSku}
          disabled={disabled || debouncedSearch.length < 2 || searchQuery.isLoading}
          loading={searchQuery.isLoading}
          placeholder={
            debouncedSearch.length < 2 ? "Type to search catalog" : "Add SKU"
          }
        />
      </LabeledField>
      {error ? (
        <p className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </FieldRow>
  );
}

export function SalesOrderDraftWorkspace({
  salesOrderId,
  customerId,
  documentNumber,
  initialLines,
}: {
  salesOrderId: string;
  customerId: string;
  documentNumber: string;
  initialLines: readonly SalesOrderLineResponse[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shipTosQuery = useListInternalCustomerShipTos(customerId);
  const replaceMutation = useReplaceInternalSalesOrderLines();
  const confirmMutation = useConfirmInternalSalesOrder();
  const cancelMutation = useCancelInternalSalesOrder();

  const [lines, setLines] = useState<SalesOrderLineDraft[]>(() =>
    draftLinesFromOrder(initialLines),
  );
  const [selectedShipToId, setSelectedShipToId] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [creditOverrideDialogOpen, setCreditOverrideDialogOpen] = useState(false);
  const [creditOverrideMessage, setCreditOverrideMessage] = useState<string | null>(null);

  const lastSavedLinesRef = useRef(lines);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const persistChainRef = useRef(Promise.resolve(true));
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistSucceededRef = useRef(true);

  const lineSkus = useMemo(() => lines.map((line) => line.sku), [lines]);
  const { productBySku, statusBySku } = useCatalogProductsBySku(lineSkus);

  useEffect(() => {
    setLines((current) => {
      let changed = false;
      const next = current.map((line) => {
        if (line.productId.length > 0) {
          return line;
        }
        const product = productBySku.get(line.sku);
        if (!product) {
          return line;
        }
        changed = true;
        return { ...line, productId: product.id };
      });
      return changed ? next : current;
    });
  }, [productBySku]);

  const shipToItems =
    shipTosQuery.data?.status === 200 ? shipTosQuery.data.data.items : [];

  useEffect(() => {
    if (selectedShipToId.length > 0) {
      return;
    }
    const defaultShipTo = shipToItems.find((shipTo) => shipTo.isDefault);
    if (defaultShipTo) {
      setSelectedShipToId(defaultShipTo.id);
    }
  }, [selectedShipToId, shipToItems]);

  const invalidateOrder = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getGetInternalSalesOrderQueryKey(salesOrderId),
    });
    await queryClient.invalidateQueries({
      queryKey: getListInternalSalesOrdersQueryKey(),
    });
  }, [queryClient, salesOrderId]);

  const persistReplace = useCallback(
    (nextLines: SalesOrderLineDraft[], force = false): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        const payloadLines = nextLines;
        if (!salesOrderLinesResolved(payloadLines)) {
          return false;
        }
        if (
          !force &&
          salesOrderLineWritesEqual(payloadLines, lastSavedLinesRef.current)
        ) {
          lastPersistSucceededRef.current = true;
          return true;
        }
        setSaveState("saving");
        setActionError(null);
        try {
          const result = await replaceMutation.mutateAsync({
            id: salesOrderId,
            data: { lines: salesOrderWriteLines(payloadLines) },
          });
          if (result.status === 200) {
            if (result.data.status === "cancelled") {
              await invalidateOrder();
              router.push("/sales");
              return true;
            }
            lastSavedLinesRef.current = payloadLines;
            lastPersistSucceededRef.current = true;
            setSaveState("saved");
            await invalidateOrder();
            return true;
          }
          setSaveState("error");
          setActionError(replaceSalesOrderLinesErrorMessage(result));
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
    [invalidateOrder, replaceMutation, router, salesOrderId],
  );

  const linesResolved = salesOrderLinesResolved(lines);
  const catalogLookupPending = salesOrderCatalogLookupPending(lines, statusBySku);
  const actionLocked =
    saveState === "saving" ||
    confirmMutation.isPending ||
    cancelMutation.isPending;
  const lineEditLocked = catalogLookupPending || actionLocked;

  useEffect(() => {
    if (!linesResolved || catalogLookupPending) {
      return;
    }
    if (salesOrderLineWritesEqual(lines, lastSavedLinesRef.current)) {
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void persistReplace(linesRef.current);
    }, 600);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [catalogLookupPending, lines, linesResolved, persistReplace]);

  const flushAutosave = useCallback(
    async (force = false) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return persistReplace(linesRef.current, force);
    },
    [persistReplace],
  );

  const addLines = useCallback((next: SalesOrderLineDraft[]) => {
    if (next.length === 0) {
      return;
    }
    setActionError(null);
    setLines((current) => {
      const taken = new Set(current.map((line) => line.sku));
      const merged = [...current];
      for (const line of next) {
        if (taken.has(line.sku)) {
          continue;
        }
        merged.push(line);
        taken.add(line.sku);
      }
      return merged;
    });
  }, []);

  const updateLineQty = useCallback((rowKey: string, qty: number) => {
    setLines((current) =>
      current.map((line) =>
        line.rowKey === rowKey ? { ...line, qty: Math.max(1, qty) } : line,
      ),
    );
  }, []);

  const removeLines = useCallback((rowKeys: readonly string[]) => {
    const remove = new Set(rowKeys);
    setLines((current) => current.filter((line) => !remove.has(line.rowKey)));
  }, []);

  const rows = useMemo<SalesOrderLineRow[]>(
    () => lines.map((line, rowIndex) => ({ ...line, rowIndex })),
    [lines],
  );

  const table = useTable({
    data: rows,
    columns: [
      { id: "sku", label: "SKU", sort: false as const },
      { id: "name", label: "Product", sort: false as const },
      {
        id: "qty",
        label: "Qty",
        sort: false as const,
        width: 120,
        align: "right" as const,
        render: ({ record }: { record: SalesOrderLineRow }) => (
          <Input
            type="number"
            min={1}
            value={record.qty}
            disabled={lineEditLocked || record.productId.length === 0}
            onChange={(event) =>
              updateLineQty(record.rowKey, Number(event.target.value))
            }
          />
        ),
      },
      {
        id: "unitPrice",
        label: "Unit price",
        sort: false as const,
        align: "right" as const,
        render: ({ record }: { record: SalesOrderLineRow }) =>
          formatMoneyMinorUnits(record.unitPriceCents, record.currency),
      },
      {
        id: "lineTotal",
        label: "Line total",
        sort: false as const,
        align: "right" as const,
        render: ({ record }: { record: SalesOrderLineRow }) =>
          formatMoneyMinorUnits(
            lineSubtotalCents(record.qty, record.unitPriceCents),
            record.currency,
          ),
      },
      {
        id: "remove",
        label: "",
        sort: false as const,
        width: 120,
        align: "right" as const,
        render: ({ record }: { record: SalesOrderLineRow }) => (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={actionLocked}
            onClick={() => removeLines([record.rowKey])}
          >
            <Trash2 className="size-icon" aria-hidden />
            Remove
          </Button>
        ),
      },
    ],
    getRowId: (row) => row.rowKey,
    fillColumn: "name",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  const currency = lines[0]?.currency ?? "USD";
  const subtotalCents = salesOrderSubtotalCents(lines);
  const linesDirty = !salesOrderLineWritesEqual(lines, lastSavedLinesRef.current);
  const autosavePending = saveState === "saving";
  const cancelDisabled = salesOrderCancelDisabled({
    status: "draft",
    autosavePending,
    cancelPending: cancelMutation.isPending,
    confirmPending: confirmMutation.isPending,
    shipPending: false,
  });
  const confirmDisabled = salesOrderConfirmDisabled({
    status: "draft",
    lineCount: lines.length,
    shipToId: selectedShipToId,
    autosavePending,
    linesDirty,
    linesUnresolved: !linesResolved,
    catalogLookupPending,
    confirmPending: confirmMutation.isPending,
    cancelPending: cancelMutation.isPending,
  });

  const confirmOrder = useCallback(
    async (overrideCredit = false) => {
      setActionError(null);
      const saved = await flushAutosave(true);
      if (!saved) {
        return;
      }
      try {
        const result = await confirmMutation.mutateAsync({
          id: salesOrderId,
          data: {
            idempotencyKey: `confirm-${salesOrderId}`,
            shipToId: selectedShipToId,
            ...(overrideCredit ? { overrideCredit: true } : {}),
          },
        });
        if (result.status !== 200) {
          if (!overrideCredit && isCreditExceededConfirmError(result)) {
            setCreditOverrideMessage(formatCreditExceededMessage(result.data ?? {}));
            setCreditOverrideDialogOpen(true);
            return;
          }
          setActionError(confirmSalesOrderErrorMessage(result));
          return;
        }
        setCreditOverrideDialogOpen(false);
        setCreditOverrideMessage(null);
        await invalidateOrder();
        router.refresh();
      } catch {
        setActionError("Could not confirm this sales order.");
      }
    },
    [
      confirmMutation,
      flushAutosave,
      invalidateOrder,
      router,
      salesOrderId,
      selectedShipToId,
    ],
  );

  const cancelOrder = useCallback(async () => {
    setActionError(null);
    try {
      const result = await cancelMutation.mutateAsync({
        id: salesOrderId,
        data: { idempotencyKey: `cancel-${salesOrderId}` },
      });
      if (result.status !== 200) {
        setActionError(cancelSalesOrderErrorMessage(result));
        return;
      }
      await invalidateOrder();
      router.push("/sales");
    } catch {
      setActionError("Could not cancel this sales order.");
    }
  }, [cancelMutation, invalidateOrder, router, salesOrderId]);

  useBreadcrumbLabel(salesOrderId, documentNumber);

  const saveLabel =
    catalogLookupPending
      ? "Resolving SKUs"
      : saveState === "saving"
        ? "Saving"
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Save failed"
            : "Autosave on";
  const saveChipColor =
    catalogLookupPending || saveState === "saving"
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
          busy={catalogLookupPending || saveState === "saving"}
          icon={<Chip.Dot />}
          aria-live="polite"
          style={{ "--chip-color": saveChipColor } as CSSProperties}
        >
          {saveLabel}
        </Chip>
      </DashboardTopbarPortal>

      <header className="flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{documentNumber}</h1>
          <p className="page-description mt-2">
            Edit draft lines, pick a ship-to, then confirm to allocate inventory.
          </p>
          <CustomerName customerId={customerId} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-action">
          <Button
            type="button"
            variant="secondary"
            disabled={cancelDisabled}
            onClick={() => void cancelOrder()}
          >
            <Ban className="size-icon-lg" aria-hidden />
            Cancel Order
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={confirmDisabled}
            onClick={() => void confirmOrder()}
          >
            <CircleCheck className="size-icon-lg" aria-hidden />
            Confirm Order
          </Button>
        </div>
      </header>

      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {!linesResolved && !catalogLookupPending ? (
        <p className="text-body-sm text-error" role="alert">
          One or more line SKUs could not be resolved in the catalog.
        </p>
      ) : null}

      <SalesOrderProductSearchAdder
        lines={lines}
        disabled={lineEditLocked}
        onAddLines={addLines}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-tight">
        <Table sticky table={table} emptyMessage="Add at least one catalog line.">
          <Table.Header />
          <Table.Body />
          <Table.Empty />
        </Table>
      </div>

      <div className="section-flat rounded-section p-4">
        <h2 className="text-body-sm font-semibold text-fg">Ship To</h2>
        {shipTosQuery.isLoading ? (
          <p className="text-body-sm text-fg-secondary mt-2">Loading ship-to addresses…</p>
        ) : shipToItems.length === 0 ? (
          <p className="text-body-sm text-error mt-2" role="alert">
            No ship-to addresses on file for this customer.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {shipToItems.map((shipTo) => (
              <li key={shipTo.id}>
                <label className="flex cursor-pointer gap-3 rounded-interactable border border-border-field px-4 py-3">
                  <input
                    type="radio"
                    name="sales-order-ship-to"
                    value={shipTo.id}
                    checked={selectedShipToId === shipTo.id}
                    disabled={lineEditLocked}
                    onChange={() => setSelectedShipToId(shipTo.id)}
                    className="mt-1"
                  />
                  <span className="text-body-sm text-fg">
                    <span className="font-semibold">{shipTo.line1}</span>
                    {shipTo.line2 ? `, ${shipTo.line2}` : ""}
                    <br />
                    {shipTo.city}, {shipTo.region} {shipTo.postal}
                    <br />
                    {shipTo.country}
                    {shipTo.isDefault ? (
                      <span className="text-fg-secondary"> (Default)</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section-flat rounded-section px-4 py-3">
        <p className="text-body-sm font-semibold text-fg">
          Subtotal {formatMoneyMinorUnits(subtotalCents, currency)}
        </p>
      </div>

      <Dialog
        open={creditOverrideDialogOpen}
        onOpenChange={(open) => {
          setCreditOverrideDialogOpen(open);
          if (!open) {
            setCreditOverrideMessage(null);
          }
        }}
      >
        <Dialog.Content
          size="sm"
          className="overlay border-error"
          data-testid="sales-order-credit-override-dialog"
        >
          <Dialog.Header>
            <Dialog.Title>Credit Limit Exceeded</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <Dialog.Description className="text-error">
              {creditOverrideMessage ??
                "This order exceeds the customer&apos;s available credit."}{" "}
              Confirm only if you intend to place it anyway.
            </Dialog.Description>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close
              render={
                <Button type="button" variant="ghost" size="sm">
                  Cancel
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={confirmMutation.isPending}
              onClick={() => void confirmOrder(true)}
            >
              <CircleCheck className="size-icon" aria-hidden />
              {confirmMutation.isPending ? "Confirming…" : "Confirm Anyway"}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </section>
  );
}
