import { PurchaseOrderWorkspace } from "../../../../components/purchase-order-workspace";

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseOrderWorkspace purchaseOrderId={id} />;
}
