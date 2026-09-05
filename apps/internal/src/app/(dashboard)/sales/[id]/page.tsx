import { SalesOrderWorkspace } from "../../../../components/sales-order-workspace";

export default async function SalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SalesOrderWorkspace salesOrderId={id} />;
}
