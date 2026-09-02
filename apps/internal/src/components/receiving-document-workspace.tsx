"use client";

import {
  getGetInternalPurchaseOrderQueryKey,
  getGetInternalPurchaseOrderShortReadoutQueryKey,
  getListInternalPurchaseOrderGoodsReceivedQueryKey,
  getListInternalPurchaseOrdersQueryKey,
  useCancelRemainingInternalPurchaseOrder,
  useGetInternalPurchaseOrder,
  useGetInternalPurchaseOrderShortReadout,
  useGetInternalSupplier,
  useListInternalPurchaseOrderGoodsReceived,
  useReceiveInternalPurchaseOrder,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Checkbox,
  Dialog,
  ExplorerView,
  FieldRow,
  formatDateTime,
  Input,
  Label,
  LabeledField,
  Table,
  useTable,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { purchaseOrderLineRemainingQty } from "../lib/purchase-order-line-remaining-qty";
import { purchaseOrderRemainingQty } from "../lib/purchase-order-remaining-qty";

type PurchaseOrderLine = {
  id: string;
  sku: string;
  name: string;
  qty: number;
  receivedQty: number;
};

type InternalPurchaseOrder = {
  id: string;
  supplierId: string;
  documentNumber: string;
  status: "draft" | "confirmed" | "received" | "cancelled";
  shipDate: string | null;
  cancelDate: string | null;
  lines: PurchaseOrderLine[];
};

type ReceiveLineRow = PurchaseOrderLine & {
  remaining: number;
};

function SupplierName({ supplierId }: { supplierId: string }) {
  const supplierQuery = useGetInternalSupplier(supplierId);
  if (supplierQuery.data?.status !== 200) {
    return null;
  }
  return (
    <p className="text-body-sm text-fg-secondary mt-1">
      {supplierQuery.data.data.name}
    </p>
  );
}

function ReceivingLineQtyInput({
  sku,
  remaining,
  value,
  disabled,
  onChange,
}: {
  sku: string;
  remaining: number;
  value: number;
  disabled?: boolean;
  onChange: (qty: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  if (remaining <= 0) {
    return <span className="tabular-nums text-fg-secondary">0</span>;
  }

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
        if (raw === "") {
          return;
        }
        const next = Number(raw);
        if (Number.isInteger(next) && next > 0 && next <= remaining) {
          onChange(next);
        }
      }}
      onBlur={() => {
        const parsed = Number(draft);
        if (
          Number.isInteger(parsed) &&
          parsed > 0 &&
          parsed <= remaining
        ) {
          onChange(parsed);
          setDraft(String(parsed));
          return;
        }
        setDraft(String(value));
      }}
      disabled={disabled}
      aria-label={`Receive quantity for ${sku}`}
    />
  );
}

function filterReceiveLines(
  lines: readonly ReceiveLineRow[],
  find: string,
  remainingOnly: boolean,
): ReceiveLineRow[] {
  const needle = find.trim().toLowerCase();
  return lines.filter((line) => {
    if (remainingOnly && line.remaining <= 0) {
      return false;
    }
    if (needle.length === 0) {
      return true;
    }
    return (
      line.sku.toLowerCase().includes(needle) ||
      line.name.toLowerCase().includes(needle)
    );
  });
}

function purchaseOrderWasShortReceived(
  lines: readonly PurchaseOrderLine[],
): boolean {
  return lines.some((line) => line.receivedQty < line.qty);
}

function purchaseOrderHasReceivedQty(
  lines: readonly PurchaseOrderLine[],
): boolean {
  return lines.some((line) => line.receivedQty > 0);
}

type GoodsReceivedRow = {
  id: string;
  createdAt: string;
  sku: string;
  quantity: number;
};

function ReceivingHistorySection({
  purchaseOrderId,
}: {
  purchaseOrderId: string;
}) {
  const historyQuery = useListInternalPurchaseOrderGoodsReceived(
    purchaseOrderId,
  );
  const rows = useMemo<GoodsReceivedRow[]>(() => {
    if (historyQuery.data?.status !== 200) {
      return [];
    }
    return historyQuery.data.data.items.map((item, index) => ({
      id: `${item.createdAt}-${item.sku}-${item.quantity}-${index}`,
      createdAt: item.createdAt,
      sku: item.sku,
      quantity: item.quantity,
    }));
  }, [historyQuery.data]);

  const columns = useMemo(
    () => [
      {
        id: "when",
        label: "When",
        sort: false as const,
        width: 200,
        render: ({ record }: { record: GoodsReceivedRow }) =>
          formatDateTime(record.createdAt, "UTC"),
      },
      {
        id: "sku",
        label: "SKU",
        sort: false as const,
        width: 160,
        render: ({ record }: { record: GoodsReceivedRow }) => record.sku,
      },
      {
        id: "qty",
        label: "Qty",
        sort: false as const,
        width: 120,
        align: "right" as const,
        render: ({ record }: { record: GoodsReceivedRow }) => (
          <span className="tabular-nums">{record.quantity}</span>
        ),
      },
    ],
    [],
  );

  const table = useTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    fillColumn: "sku",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  if (historyQuery.isLoading) {
    return (
      <section className="flex flex-col gap-form-section">
        <h2 className="text-heading-sm">Receive history</h2>
        <p className="text-body-sm text-fg-secondary">Loading history…</p>
      </section>
    );
  }

  if (historyQuery.isError) {
    return (
      <section className="flex flex-col gap-form-section">
        <h2 className="text-heading-sm">Receive history</h2>
        <p className="text-body-sm text-error" role="alert">
          Could not load receive history.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col gap-form-section">
      <h2 className="text-heading-sm">Receive history</h2>
      <Table
        className="min-h-0"
        table={table}
        emptyMessage="No goods received yet."
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>
    </section>
  );
}

function ReceivingShortPanel({
  purchaseOrderId,
}: {
  purchaseOrderId: string;
}) {
  const shortReadoutQuery = useGetInternalPurchaseOrderShortReadout(
    purchaseOrderId,
  );

  if (shortReadoutQuery.isLoading) {
    return (
      <section className="flex flex-col gap-form-section">
        <h2 className="text-heading-sm">Short readout</h2>
        <p className="text-body-sm text-fg-secondary">Loading short readout…</p>
      </section>
    );
  }

  if (shortReadoutQuery.isError) {
    return (
      <section className="flex flex-col gap-form-section">
        <h2 className="text-heading-sm">Short readout</h2>
        <p className="text-body-sm text-error" role="alert">
          Could not load short readout.
        </p>
      </section>
    );
  }

  if (shortReadoutQuery.data?.status !== 200) {
    return null;
  }

  const { uncovered, affectedCustomers } = shortReadoutQuery.data.data;
  const uncoveredRows = uncovered.filter((row) => row.uncovered > 0);
  const hasUncovered = uncoveredRows.length > 0;

  return (
    <section className="flex flex-col gap-form-section">
      <h2 className="text-heading-sm">Short readout</h2>
      {hasUncovered ? (
        <ul className="text-body-sm">
          {uncoveredRows.map((row) => (
            <li key={row.sku} className="tabular-nums">
              {row.sku}: {row.uncovered} uncovered
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-fg-secondary">Nobody to chase.</p>
      )}
      {affectedCustomers.length > 0 ? (
        <div>
          <p className="text-label text-fg-secondary">Affected customers</p>
          <ul className="mt-1 text-body-sm">
            {affectedCustomers.map((customer) => (
              <li key={customer.customerId}>{customer.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-body-sm text-fg-secondary">
        Follow up with affected customers off the warehouse floor.
      </p>
    </section>
  );
}

function ReceivingDocumentBody({
  purchaseOrderId,
  po,
}: {
  purchaseOrderId: string;
  po: InternalPurchaseOrder;
}) {
  const queryClient = useQueryClient();
  const receiveMutation = useReceiveInternalPurchaseOrder();
  const cancelRemainingMutation = useCancelRemainingInternalPurchaseOrder();
  const [cancelRemainingDialogOpen, setCancelRemainingDialogOpen] =
    useState(false);
  const [find, setFind] = useState("");
  const [remainingOnly, setRemainingOnly] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelRemainingError, setCancelRemainingError] = useState<
    string | null
  >(null);
  const [receiveQtyByLineId, setReceiveQtyByLineId] = useState<
    Record<string, number>
  >({});

  const rows = useMemo<ReceiveLineRow[]>(
    () =>
      po.lines.map((line) => ({
        ...line,
        remaining: purchaseOrderLineRemainingQty(line),
      })),
    [po.lines],
  );

  useEffect(() => {
    setReceiveQtyByLineId(
      Object.fromEntries(
        rows.map((line) => [
          line.id,
          line.remaining > 0 ? line.remaining : 0,
        ]),
      ),
    );
  }, [rows]);

  const filteredRows = useMemo(
    () => filterReceiveLines(rows, find, remainingOnly),
    [find, remainingOnly, rows],
  );

  const totalRemaining = useMemo(
    () => purchaseOrderRemainingQty(po.lines),
    [po.lines],
  );

  const canReceive = po.status === "confirmed" && totalRemaining > 0;
  const canCancelRemaining =
    po.status === "confirmed" &&
    totalRemaining > 0 &&
    purchaseOrderHasReceivedQty(po.lines);
  const showShortPanel =
    po.status === "received" && purchaseOrderWasShortReceived(po.lines);

  const updateReceiveQty = useCallback((lineId: string, qty: number) => {
    setReceiveQtyByLineId((current) => ({ ...current, [lineId]: qty }));
  }, []);

  const submitReceive = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canReceive || receiveMutation.isPending) {
        return;
      }

      const lines = rows
        .map((line) => ({
          lineId: line.id,
          quantity: receiveQtyByLineId[line.id] ?? 0,
        }))
        .filter((line) => line.quantity > 0);

      if (lines.length === 0) {
        setActionError("Enter a receive quantity on at least one line.");
        return;
      }

      setActionError(null);
      try {
        const result = await receiveMutation.mutateAsync({
          id: purchaseOrderId,
          data: {
            idempotencyKey: crypto.randomUUID(),
            lines,
          },
        });
        if (result.status === 200) {
          await queryClient.invalidateQueries({
            queryKey: getGetInternalPurchaseOrderQueryKey(purchaseOrderId),
          });
          await queryClient.invalidateQueries({
            queryKey: getListInternalPurchaseOrdersQueryKey(),
          });
          await queryClient.invalidateQueries({
            queryKey:
              getListInternalPurchaseOrderGoodsReceivedQueryKey(purchaseOrderId),
          });
          return;
        }
        setActionError("Receive failed.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Receive failed.";
        setActionError(message);
      }
    },
    [
      canReceive,
      purchaseOrderId,
      queryClient,
      receiveMutation,
      receiveQtyByLineId,
      rows,
    ],
  );

  const submitCancelRemaining = useCallback(async () => {
    if (!canCancelRemaining || cancelRemainingMutation.isPending) {
      return;
    }

    setCancelRemainingError(null);
    try {
      const result = await cancelRemainingMutation.mutateAsync({
        id: purchaseOrderId,
        data: { idempotencyKey: crypto.randomUUID() },
      });
      if (result.status === 200) {
        setCancelRemainingDialogOpen(false);
        await queryClient.invalidateQueries({
          queryKey: getGetInternalPurchaseOrderQueryKey(purchaseOrderId),
        });
        await queryClient.invalidateQueries({
          queryKey: getListInternalPurchaseOrdersQueryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey:
            getListInternalPurchaseOrderGoodsReceivedQueryKey(purchaseOrderId),
        });
        await queryClient.invalidateQueries({
          queryKey:
            getGetInternalPurchaseOrderShortReadoutQueryKey(purchaseOrderId),
        });
        return;
      }
      setCancelRemainingError("Cancel remaining failed.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cancel remaining failed.";
      if (message.includes("403")) {
        setCancelRemainingError(
          "Forbidden — requires warehouse stock manage and purchasing manage permissions.",
        );
        return;
      }
      setCancelRemainingError(message);
    }
  }, [
    canCancelRemaining,
    cancelRemainingMutation,
    purchaseOrderId,
    queryClient,
  ]);

  const columns = useMemo(
    () => [
      {
        id: "sku",
        label: "SKU",
        sort: false as const,
        width: 160,
        render: ({ record }: { record: ReceiveLineRow }) => record.sku,
      },
      {
        id: "name",
        label: "Name",
        sort: false as const,
        render: ({ record }: { record: ReceiveLineRow }) => record.name,
      },
      {
        id: "ordered",
        label: "Ordered",
        sort: false as const,
        width: 120,
        align: "right" as const,
        render: ({ record }: { record: ReceiveLineRow }) => (
          <span className="tabular-nums">{record.qty}</span>
        ),
      },
      {
        id: "received",
        label: "Received",
        sort: false as const,
        width: 120,
        align: "right" as const,
        render: ({ record }: { record: ReceiveLineRow }) => (
          <span className="tabular-nums">{record.receivedQty}</span>
        ),
      },
      {
        id: "remaining",
        label: "Remaining",
        sort: false as const,
        width: 120,
        align: "right" as const,
        render: ({ record }: { record: ReceiveLineRow }) => (
          <span className="tabular-nums">{record.remaining}</span>
        ),
      },
      {
        id: "receiveQty",
        label: "Receive",
        sort: false as const,
        width: 160,
        truncate: false,
        align: "right" as const,
        render: ({ record }: { record: ReceiveLineRow }) => (
          <ReceivingLineQtyInput
            sku={record.sku}
            remaining={record.remaining}
            value={receiveQtyByLineId[record.id] ?? 0}
            disabled={!canReceive || receiveMutation.isPending}
            onChange={(qty) => updateReceiveQty(record.id, qty)}
          />
        ),
      },
    ],
    [
      canReceive,
      receiveMutation.isPending,
      receiveQtyByLineId,
      updateReceiveQty,
    ],
  );

  const table = useTable({
    data: filteredRows,
    columns,
    getRowId: (row) => row.id,
    fillColumn: "name",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  return (
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        <header className="mt-2">
          <nav className="text-body-sm text-fg-secondary">
            <Link href="/receiving" className="text-link hover:text-link-hover">
              Receiving
            </Link>
            <span aria-hidden="true"> / </span>
            <span>{po.documentNumber}</span>
          </nav>
          <h1 className="page-title mt-1">{po.documentNumber}</h1>
          <SupplierName supplierId={po.supplierId} />
          <dl className="mt-4 grid gap-field-group sm:grid-cols-3">
            <div>
              <dt className="text-label text-fg-secondary">Ship date</dt>
              <dd className="mt-1 tabular-nums">{po.shipDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-label text-fg-secondary">Cancel date</dt>
              <dd className="mt-1 tabular-nums">{po.cancelDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-label text-fg-secondary">Remaining</dt>
              <dd className="mt-1 tabular-nums">{totalRemaining}</dd>
            </div>
          </dl>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <div className="flex min-h-0 flex-1 flex-col gap-form-section">
          <FieldRow>
            <LabeledField className="min-w-56 flex-1">
              <Label htmlFor="receiving-find">Find</Label>
              <Input
                id="receiving-find"
                type="search"
                value={find}
                onChange={(event) => setFind(event.target.value)}
                placeholder="SKU or name"
              />
            </LabeledField>
            <LabeledField className="min-w-56">
              <span className="text-label text-fg-secondary">Filter</span>
              <div className="flex min-h-(--space-input-height) items-center gap-field">
                <Checkbox
                  id="receiving-remaining-only"
                  checked={remainingOnly}
                  onChange={setRemainingOnly}
                />
                <Label htmlFor="receiving-remaining-only" className="mb-0">
                  Remaining only
                </Label>
              </div>
            </LabeledField>
          </FieldRow>

          <form
            className="flex min-h-0 flex-1 flex-col gap-form-section"
            onSubmit={submitReceive}
          >
            <Table
              sticky
              className="min-h-0 flex-1"
              table={table}
              emptyMessage={
                remainingOnly || find.trim().length > 0
                  ? "No lines match the current filters."
                  : "This purchase order has no lines."
              }
            >
              <Table.Header />
              <Table.Body />
              <Table.Empty />
            </Table>

            {po.status !== "confirmed" ? (
              <p className="text-body-sm text-fg-secondary" role="status">
                Only confirmed purchase orders can be received.
              </p>
            ) : null}

            {actionError ? (
              <p className="text-body-sm text-error" role="alert">
                {actionError}
              </p>
            ) : null}

            <FieldRow>
              <Button
                type="submit"
                variant="primary"
                disabled={!canReceive || receiveMutation.isPending}
              >
                {receiveMutation.isPending ? "Receiving…" : "Receive"}
              </Button>
              {canCancelRemaining ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={cancelRemainingMutation.isPending}
                  onClick={() => setCancelRemainingDialogOpen(true)}
                >
                  Cancel remaining
                </Button>
              ) : null}
            </FieldRow>

            {cancelRemainingError ? (
              <p className="text-body-sm text-error" role="alert">
                {cancelRemainingError}
              </p>
            ) : null}
          </form>

          <Dialog
            open={cancelRemainingDialogOpen}
            onOpenChange={setCancelRemainingDialogOpen}
          >
            <Dialog.Content
              size="sm"
              data-testid="receiving-cancel-remaining-confirm-dialog"
            >
              <Dialog.Header>
                <Dialog.Title>Cancel remaining?</Dialog.Title>
                <Dialog.Close />
              </Dialog.Header>
              <Dialog.Body>
                <Dialog.Description>
                  Remaining on this PO will never be stock; document becomes
                  received.
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
                  disabled={cancelRemainingMutation.isPending}
                  onClick={() => void submitCancelRemaining()}
                >
                  {cancelRemainingMutation.isPending
                    ? "Cancelling…"
                    : "Cancel remaining"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>

          {showShortPanel ? (
            <ReceivingShortPanel purchaseOrderId={purchaseOrderId} />
          ) : null}

          <ReceivingHistorySection purchaseOrderId={purchaseOrderId} />
        </div>
      </ExplorerView.Content>
    </ExplorerView>
  );
}

export function ReceivingDocumentWorkspace({
  purchaseOrderId,
}: {
  purchaseOrderId: string;
}) {
  const poQuery = useGetInternalPurchaseOrder(purchaseOrderId);
  const po = poQuery.data?.status === 200 ? poQuery.data.data : undefined;

  if (poQuery.isLoading) {
    return (
      <p className="text-body-sm text-fg-secondary">Loading purchase order…</p>
    );
  }

  if (poQuery.isError) {
    const message =
      poQuery.error instanceof Error ? poQuery.error.message : "";
    if (message.includes("404")) {
      notFound();
    }
    return (
      <p className="text-body-sm text-error" role="alert">
        Could not load purchase order.
      </p>
    );
  }

  if (!po) {
    notFound();
  }

  return (
    <ReceivingDocumentBody
      purchaseOrderId={purchaseOrderId}
      po={po as InternalPurchaseOrder}
    />
  );
}
