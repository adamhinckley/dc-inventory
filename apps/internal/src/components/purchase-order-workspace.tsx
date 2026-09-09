"use client";

import { useGetInternalPurchaseOrder } from "@dc-inventory/api-client-internal";
import { coalescePurchaseOrderLines } from "../lib/purchase-order-line-math";
import { PurchaseOrderDraftWorkspace } from "./purchase-order-draft-workspace";
import { PurchaseOrderFactorySendWorkspace } from "./purchase-order-factory-send-workspace";

export function PurchaseOrderWorkspace({
  purchaseOrderId,
}: {
  purchaseOrderId?: string;
}) {
  if (!purchaseOrderId) {
    return (
      <PurchaseOrderDraftWorkspace
        initialSupplierId={null}
        initialLines={[]}
        initialShipDate={null}
        initialCancelDate={null}
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
      <PurchaseOrderFactorySendWorkspace
        purchaseOrderId={purchaseOrderId}
        documentNumber={po.documentNumber}
        status={po.status}
        supplierId={po.supplierId}
        shipDate={po.shipDate}
        cancelDate={po.cancelDate}
        lines={po.lines}
      />
    );
  }

  return (
    <PurchaseOrderDraftWorkspace
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
    />
  );
}
