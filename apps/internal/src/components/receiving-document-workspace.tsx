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
  DescriptionList,
  DevComment,
  Dialog,
  ExplorerView,
  formatDateTime,
  Input,
  Label,
  RouterTabs,
  Table,
  TextInput,
  useTable,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { PackageCheck, PackageX } from "lucide-react";
import { notFound } from "next/navigation";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  filterReceiveLines,
  purchaseOrderLineRemainingQty,
  purchaseOrderRemainingQty,
  receiveLinesPayload,
  receivingCanCancelRemaining,
  receivingCanReceive,
  receivingShowShortPanel,
} from "../lib/purchase-order-line-math";

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

type ReceivingDocumentContextValue = {
  purchaseOrderId: string;
  find: string;
  setFind: (value: string) => void;
  remainingOnly: boolean;
  setRemainingOnly: (value: boolean) => void;
  table: ReturnType<typeof useTable<ReceiveLineRow>>;
  submitReceive: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  showShortPanel: boolean;
  poStatus: InternalPurchaseOrder["status"];
  canReceive: boolean;
  receivePending: boolean;
  actionError: string | null;
  canCancelRemaining: boolean;
  cancelRemainingPending: boolean;
  openCancelRemaining: () => void;
};

const ReceivingDocumentContext = createContext<ReceivingDocumentContextValue | null>(
  null,
);

function useReceivingDocument() {
  const ctx = use(ReceivingDocumentContext);
  if (!ctx) {
    throw new Error(
      "Receiving document tab must render inside ReceivingDocumentWorkspace",
    );
  }
  return ctx;
}

function SupplierName({ supplierId }: { supplierId: string }) {
  const supplierQuery = useGetInternalSupplier(supplierId);
  if (supplierQuery.data?.status !== 200) {
    return "—";
  }
  return supplierQuery.data.data.name;
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
      <p className="text-body-sm text-fg-secondary">Loading history…</p>
    );
  }

  if (historyQuery.isError) {
    return (
      <p className="text-body-sm text-error" role="alert">
        Could not load receive history.
      </p>
    );
  }

  return (
    <Table
      sticky
      className="min-h-0 flex-1"
      table={table}
      emptyMessage="No goods received yet."
    >
      <Table.Header />
      <Table.Body />
      <Table.Empty />
    </Table>
  );
}

export function ReceivingDocumentLines() {
  const {
    find,
    setFind,
    remainingOnly,
    setRemainingOnly,
    table,
    submitReceive,
    showShortPanel,
    purchaseOrderId,
    poStatus,
    canReceive,
    receivePending,
    actionError,
    canCancelRemaining,
    cancelRemainingPending,
    openCancelRemaining,
  } = useReceivingDocument();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      {poStatus !== "confirmed" ? (
        <p className="text-body-sm text-fg-secondary" role="status">
          Only confirmed purchase orders can be received.
        </p>
      ) : null}
      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <TextInput
        id="receiving-find"
        type="search"
        density="compact"
        className="w-52 shrink-0"
        aria-label="Find"
        value={find}
        onChange={setFind}
        placeholder="SKU or name"
        data-testid="receiving-document-find-input"
      />
      <form
        id="receiving-receive-form"
        className="flex min-h-0 flex-1 flex-col gap-form-section"
        onSubmit={submitReceive}
      >
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-field-group">
          <div className="flex shrink-0 items-center gap-field">
            <Checkbox
              id="receiving-remaining-only"
              density="compact"
              checked={remainingOnly}
              onChange={setRemainingOnly}
              data-testid="receiving-document-remaining-only-checkbox"
            />
            <Label htmlFor="receiving-remaining-only">Remaining only</Label>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-field-group">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canCancelRemaining || cancelRemainingPending}
              onClick={openCancelRemaining}
            >
              <PackageX className="size-icon-lg" aria-hidden />
              Cancel Remaining
            </Button>
            <div className="relative">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!canReceive || receivePending}
              >
                <PackageCheck className="size-icon-lg" aria-hidden />
                {receivePending ? "Receiving…" : "Receive"}
              </Button>
              <DevComment align="end">
                Does it make more sense to have one receive button or one on
                every row?
              </DevComment>
            </div>
          </div>
        </div>
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
      </form>
      {showShortPanel ? (
        <ReceivingShortPanel purchaseOrderId={purchaseOrderId} />
      ) : null}
    </div>
  );
}

export function ReceivingDocumentHistory() {
  const { purchaseOrderId } = useReceivingDocument();
  return <ReceivingHistorySection purchaseOrderId={purchaseOrderId} />;
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

  const { toOrder, affectedCustomers } = shortReadoutQuery.data.data;
  const toOrderRows = toOrder.filter((row) => row.toOrder > 0);
  const hasToOrder = toOrderRows.length > 0;

  return (
    <section className="flex flex-col gap-form-section">
      <h2 className="text-heading-sm">Short readout</h2>
      {hasToOrder ? (
        <ul className="text-body-sm">
          {toOrderRows.map((row) => (
            <li key={row.sku} className="tabular-nums">
              {row.sku}: {row.toOrder} toOrder
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
  children,
}: {
  purchaseOrderId: string;
  po: InternalPurchaseOrder;
  children: ReactNode;
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

  const canReceive = receivingCanReceive(po.status, totalRemaining);
  const canCancelRemaining = receivingCanCancelRemaining(
    po.status,
    totalRemaining,
    po.lines,
  );
  const showShortPanel = receivingShowShortPanel(po.status, po.lines);

  const updateReceiveQty = useCallback((lineId: string, qty: number) => {
    setReceiveQtyByLineId((current) => ({ ...current, [lineId]: qty }));
  }, []);

  const submitReceive = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canReceive || receiveMutation.isPending) {
        return;
      }

      const lines = receiveLinesPayload(rows, receiveQtyByLineId);

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

  useBreadcrumbLabel(purchaseOrderId, po.documentNumber);

  const openCancelRemaining = useCallback(() => {
    setCancelRemainingError(null);
    setCancelRemainingDialogOpen(true);
  }, []);

  return (
    <ReceivingDocumentContext
      value={{
        purchaseOrderId,
        find,
        setFind,
        remainingOnly,
        setRemainingOnly,
        table,
        submitReceive,
        showShortPanel,
        poStatus: po.status,
        canReceive,
        receivePending: receiveMutation.isPending,
        actionError,
        canCancelRemaining,
        cancelRemainingPending: cancelRemainingMutation.isPending,
        openCancelRemaining,
      }}
    >
    <ExplorerView className="h-full min-h-0">
      <ExplorerView.Header className="border-b-0">
        <header>
          <h1 className="sr-only">{po.documentNumber}</h1>
          <DescriptionList
            maxColumns={4}
            data-testid="receiving-document-summary-list"
          >
            <DescriptionList.Item>
              <DescriptionList.Term>PO number</DescriptionList.Term>
              <DescriptionList.Data>{po.documentNumber}</DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Supplier</DescriptionList.Term>
              <DescriptionList.Data>
                <SupplierName supplierId={po.supplierId} />
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Ship date</DescriptionList.Term>
              <DescriptionList.Data className="tabular-nums">
                {po.shipDate ?? "—"}
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Cancel date</DescriptionList.Term>
              <DescriptionList.Data className="tabular-nums">
                {po.cancelDate ?? "—"}
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Remaining</DescriptionList.Term>
              <DescriptionList.Data className="tabular-nums">
                {totalRemaining}
              </DescriptionList.Data>
            </DescriptionList.Item>
          </DescriptionList>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content className="flex min-h-0 flex-col overflow-hidden">
        <RouterTabs
          className="flex min-h-0 flex-1 flex-col"
          data-testid="receiving-document-router-tabs"
        >
          <div className="relative shrink-0">
            <DevComment placement="above">
              What titles should these tabs have?
            </DevComment>
            <RouterTabs.List>
              <RouterTabs.Trigger href={`/procurement/receiving/${purchaseOrderId}`} exact>
                Lines
              </RouterTabs.Trigger>
              <RouterTabs.Trigger href={`/procurement/receiving/${purchaseOrderId}/history`}>
                History
              </RouterTabs.Trigger>
            </RouterTabs.List>
          </div>
          <RouterTabs.Panel className="flex min-h-0 flex-1 flex-col p-0 pt-card">
            {children}
          </RouterTabs.Panel>
        </RouterTabs>

          <Dialog
            open={cancelRemainingDialogOpen}
            onOpenChange={(open) => {
              setCancelRemainingDialogOpen(open);
              if (!open) {
                setCancelRemainingError(null);
              }
            }}
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
                <div className="flex flex-col gap-field-group">
                  <Dialog.Description>
                    Remaining on this PO will never be stock; document becomes
                    received.
                  </Dialog.Description>
                  {cancelRemainingError ? (
                    <p className="text-body-sm text-error" role="alert">
                      {cancelRemainingError}
                    </p>
                  ) : null}
                </div>
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
                  <PackageX className="size-icon" aria-hidden />
                  {cancelRemainingMutation.isPending
                    ? "Cancelling…"
                    : "Cancel Remaining"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
      </ExplorerView.Content>
    </ExplorerView>
    </ReceivingDocumentContext>
  );
}

export function ReceivingDocumentWorkspace({
  purchaseOrderId,
  children,
}: {
  purchaseOrderId: string;
  children: ReactNode;
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
    >
      {children}
    </ReceivingDocumentBody>
  );
}
