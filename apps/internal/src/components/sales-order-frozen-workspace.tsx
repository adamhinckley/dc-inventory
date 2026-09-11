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
  DescriptionList,
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
  salesOrderLineLeadingColumnIds,
  salesOrderLineVendorColumnId,
  salesOrderLineVendorColumnLabel,
  salesOrderLineVendorLabel,
  salesOrderShipDisabled,
  salesOrderSubtotalCents,
} from "../lib/sales-order-line-math";
import { salesOrderStatusPresentation } from "../lib/sales-order-status-chip";
import type { SalesOrderLineSnapshot } from "../lib/sales-order-types";
import { useCatalogProductsBySku } from "../lib/use-catalog-products-by-sku";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";

function CustomerName({ customerId }: { customerId: string }) {
  const customerQuery = useGetInternalCustomer(customerId);
  if (customerQuery.data?.status !== 200) {
    return "—";
  }
  return customerQuery.data.data.name;
}

function shipToLines({
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
}): string[] {
  if (!shipLine1 && !shipCity) {
    return [];
  }
  const street = [shipLine1, shipLine2].filter((part) => Boolean(part)).join(", ");
  const locality = [shipCity, [shipRegion, shipPostal].filter(Boolean).join(" ")]
    .filter((part) => part !== "")
    .join(", ");
  return [street, locality, shipCountry].filter((part): part is string => Boolean(part));
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

  const lineSkus = useMemo(() => lines.map((line) => line.sku), [lines]);
  // Supplier labels come from the live catalog, not the frozen order snapshot.
  const { productBySku, statusBySku } = useCatalogProductsBySku(lineSkus);

  const rows = useMemo<Array<SalesOrderLineSnapshot & { vendor: string }>>(
    () =>
      lines.map((line) => ({
        rowKey: line.id,
        sku: line.sku,
        name: line.name,
        vendor: salesOrderLineVendorLabel(
          productBySku.get(line.sku)?.supplierName,
          statusBySku.get(line.sku),
        ),
        qty: line.qty,
        unitPriceCents: line.unitPriceCents,
        currency: line.currency,
      })),
    [lines, productBySku, statusBySku],
  );

  const currency = rows[0]?.currency ?? "USD";
  const subtotalCents = salesOrderSubtotalCents(rows);

  const table = useTable({
    data: rows,
    columns: [
      { id: salesOrderLineLeadingColumnIds[0], label: "SKU", sort: false as const },
      { id: salesOrderLineLeadingColumnIds[1], label: "Product", sort: false as const },
      {
        id: salesOrderLineVendorColumnId,
        label: salesOrderLineVendorColumnLabel,
        sort: false as const,
      },
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
  const shipTo = shipToLines({
    shipLine1,
    shipLine2,
    shipCity,
    shipRegion,
    shipPostal,
    shipCountry,
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-form-section">
      <header className="flex flex-wrap items-start justify-end gap-action">
        <h1 className="sr-only">{documentNumber}</h1>
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

      <DescriptionList maxColumns={4} data-testid="sales-order-summary-list">
        <DescriptionList.Item>
          <DescriptionList.Term>SO number</DescriptionList.Term>
          <DescriptionList.Data>{documentNumber}</DescriptionList.Data>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Customer</DescriptionList.Term>
          <DescriptionList.Data pii>
            <CustomerName customerId={customerId} />
          </DescriptionList.Data>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Status</DescriptionList.Term>
          <DescriptionList.Data>
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
          </DescriptionList.Data>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Subtotal</DescriptionList.Term>
          <DescriptionList.Data className="tabular-nums">
            {formatMoneyMinorUnits(subtotalCents, currency)}
          </DescriptionList.Data>
        </DescriptionList.Item>
        <DescriptionList.Item span={2}>
          <DescriptionList.Term>Ship to</DescriptionList.Term>
          <DescriptionList.Data pii>
            {shipTo.length === 0
              ? "—"
              : shipTo.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
          </DescriptionList.Data>
        </DescriptionList.Item>
      </DescriptionList>

      <div className="flex min-h-0 flex-1 flex-col gap-tight">
        <Table sticky table={table} emptyMessage="This sales order has no lines.">
          <Table.Header />
          <Table.Body />
          <Table.Empty />
        </Table>
      </div>
    </section>
  );
}
