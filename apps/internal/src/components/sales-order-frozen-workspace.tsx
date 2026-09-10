"use client";

import {
  getGetInternalSalesOrderQueryKey,
  getListInternalSalesOrdersQueryKey,
  useCancelInternalSalesOrder,
  useGetInternalCustomer,
  useShipInternalSalesOrder,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  formatMoneyMinorUnits,
  Table,
  useTable,
  useToast,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, type CSSProperties } from "react";
import {
  cancelSalesOrderErrorMessage,
  shipSalesOrderErrorMessage,
} from "../lib/sales-order-action-errors";
import {
  lineSubtotalCents,
  salesOrderCancelDisabled,
  salesOrderShipDisabled,
  salesOrderSubtotalCents,
} from "../lib/sales-order-line-math";
import { salesOrderStatusPresentation } from "../lib/sales-order-status-chip";
import type { SalesOrderLineSnapshot } from "../lib/sales-order-types";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";

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

function ShipToSnapshot({
  shipLine1,
  shipLine2,
  shipCity,
  shipRegion,
  shipPostal,
  shipCountry,
}: {
  shipLine1?: string;
  shipLine2?: string | null;
  shipCity?: string;
  shipRegion?: string;
  shipPostal?: string;
  shipCountry?: string;
}) {
  if (!shipLine1 && !shipCity) {
    return (
      <p className="text-body-sm text-fg-secondary mt-4">
        Ship-to snapshot: not captured on this order.
      </p>
    );
  }

  return (
    <div className="section-flat mt-4 rounded-section p-4">
      <h2 className="text-body-sm font-semibold text-fg">Ship To</h2>
      <p className="text-body-sm text-fg-secondary mt-2">
        {shipLine1}
        {shipLine2 ? `, ${shipLine2}` : ""}
        <br />
        {shipCity}, {shipRegion} {shipPostal}
        <br />
        {shipCountry}
      </p>
    </div>
  );
}

export function SalesOrderFrozenWorkspace({
  salesOrderId,
  customerId,
  documentNumber,
  status,
  shipLine1,
  shipLine2,
  shipCity,
  shipRegion,
  shipPostal,
  shipCountry,
  lines,
}: {
  salesOrderId: string;
  customerId: string;
  documentNumber: string;
  status: string;
  shipLine1?: string;
  shipLine2?: string | null;
  shipCity?: string;
  shipRegion?: string;
  shipPostal?: string;
  shipCountry?: string;
  lines: ReadonlyArray<{
    id: string;
    sku: string;
    name: string;
    qty: number;
    unitPriceCents: number;
    currency: string;
  }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const cancelMutation = useCancelInternalSalesOrder();
  const shipMutation = useShipInternalSalesOrder();

  useBreadcrumbLabel(salesOrderId, documentNumber);

  const rows = useMemo<SalesOrderLineSnapshot[]>(
    () =>
      lines.map((line) => ({
        rowKey: line.id,
        sku: line.sku,
        name: line.name,
        qty: line.qty,
        unitPriceCents: line.unitPriceCents,
        currency: line.currency,
      })),
    [lines],
  );

  const currency = rows[0]?.currency ?? "USD";
  const subtotalCents = salesOrderSubtotalCents(rows);

  const table = useTable({
    data: rows,
    columns: [
      { id: "sku", label: "SKU", sort: false as const },
      { id: "name", label: "Product", sort: false as const },
      { id: "qty", label: "Qty", sort: false as const, align: "right" as const },
      {
        id: "unitPrice",
        label: "Unit price",
        sort: false as const,
        align: "right" as const,
        render: ({ record }) =>
          formatMoneyMinorUnits(record.unitPriceCents, record.currency),
      },
      {
        id: "lineTotal",
        label: "Line total",
        sort: false as const,
        align: "right" as const,
        render: ({ record }) =>
          formatMoneyMinorUnits(
            lineSubtotalCents(record.qty, record.unitPriceCents),
            record.currency,
          ),
      },
    ],
    getRowId: (row) => row.rowKey,
    fillColumn: "name",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  const invalidateOrder = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getGetInternalSalesOrderQueryKey(salesOrderId),
    });
    await queryClient.invalidateQueries({
      queryKey: getListInternalSalesOrdersQueryKey(),
    });
  }, [queryClient, salesOrderId]);

  const cancelOrder = useCallback(async () => {
    try {
      const result = await cancelMutation.mutateAsync({
        id: salesOrderId,
        data: { idempotencyKey: `cancel-${salesOrderId}` },
      });
      if (result.status !== 200) {
        toast({
          intent: "error",
          title: cancelSalesOrderErrorMessage(result),
          testid: "sales-order-cancel-error-toast",
        });
        return;
      }
      await invalidateOrder();
      router.refresh();
    } catch {
      toast({
        intent: "error",
        title: "Could not cancel this sales order.",
        testid: "sales-order-cancel-error-toast",
      });
    }
  }, [cancelMutation, invalidateOrder, router, salesOrderId, toast]);

  const shipOrder = useCallback(async () => {
    try {
      const result = await shipMutation.mutateAsync({
        id: salesOrderId,
        data: { idempotencyKey: `ship-${salesOrderId}` },
      });
      if (result.status !== 200) {
        toast({
          intent: "warning",
          title: shipSalesOrderErrorMessage(result),
          timeout: 0,
          testid: "sales-order-ship-warning-toast",
        });
        return;
      }
      await invalidateOrder();
      router.refresh();
    } catch {
      toast({
        intent: "warning",
        title: "Could not ship this sales order.",
        timeout: 0,
        testid: "sales-order-ship-warning-toast",
      });
    }
  }, [invalidateOrder, router, salesOrderId, shipMutation, toast]);

  const cancelDisabled = salesOrderCancelDisabled({
    status,
    autosavePending: false,
    cancelPending: cancelMutation.isPending,
    confirmPending: false,
    shipPending: shipMutation.isPending,
  });
  const shipDisabled = salesOrderShipDisabled({
    status,
    shipPending: shipMutation.isPending,
    cancelPending: cancelMutation.isPending,
  });
  const statusPresentation = salesOrderStatusPresentation(status);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-form-section">
      <header className="flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-action">
            <h1 className="page-title">{documentNumber}</h1>
            <Chip
              icon={<Chip.Dot />}
              style={
                statusPresentation
                  ? ({ "--chip-color": statusPresentation.color } as CSSProperties)
                  : undefined
              }
            >
              {statusPresentation?.label ?? status}
            </Chip>
          </div>
          <p className="page-description mt-2">
            Lines and prices are frozen for this {status} order.
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
            disabled={shipDisabled}
            onClick={() => void shipOrder()}
          >
            <Truck className="size-icon-lg" aria-hidden />
            Ship Order
          </Button>
        </div>
      </header>

      <ShipToSnapshot
        shipLine1={shipLine1}
        shipLine2={shipLine2}
        shipCity={shipCity}
        shipRegion={shipRegion}
        shipPostal={shipPostal}
        shipCountry={shipCountry}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-tight">
        <Table sticky table={table} emptyMessage="This sales order has no lines.">
          <Table.Header />
          <Table.Body />
          <Table.Empty />
        </Table>
      </div>

      <div className="section-flat rounded-section px-4 py-3">
        <p className="text-body-sm font-semibold text-fg">
          Subtotal {formatMoneyMinorUnits(subtotalCents, currency)}
        </p>
      </div>
    </section>
  );
}
