"use client";

import { useGetInternalSalesOrder } from "@dc-inventory/api-client-internal";
import { SalesOrderDraftWorkspace } from "./sales-order-draft-workspace";
import { SalesOrderFrozenWorkspace } from "./sales-order-frozen-workspace";

export function SalesOrderWorkspace({ salesOrderId }: { salesOrderId: string }) {
  const orderQuery = useGetInternalSalesOrder(salesOrderId);
  const order = orderQuery.data?.status === 200 ? orderQuery.data.data : undefined;

  if (orderQuery.isLoading) {
    return <p className="text-body-sm text-fg-secondary">Loading sales order…</p>;
  }

  if (orderQuery.isError || !order) {
    return (
      <p className="text-body-sm text-error" role="alert">
        Could not load sales order.
      </p>
    );
  }

  if (order.status === "draft") {
    return (
      <SalesOrderDraftWorkspace
        key={salesOrderId}
        salesOrderId={salesOrderId}
        customerId={order.customerId}
        documentNumber={order.documentNumber}
        initialLines={order.lines}
      />
    );
  }

  return (
    <SalesOrderFrozenWorkspace
      salesOrderId={salesOrderId}
      customerId={order.customerId}
      documentNumber={order.documentNumber}
      status={order.status}
      shipLine1={order.shipLine1}
      shipLine2={order.shipLine2}
      shipCity={order.shipCity}
      shipRegion={order.shipRegion}
      shipPostal={order.shipPostal}
      shipCountry={order.shipCountry}
      lines={order.lines}
    />
  );
}
