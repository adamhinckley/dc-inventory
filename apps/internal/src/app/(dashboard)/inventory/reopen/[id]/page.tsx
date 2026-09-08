import { SellWindowDetailPage } from "../../../../../components/inventory-reopen/sell-window-detail-page";

export default async function InventoryReopenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SellWindowDetailPage windowId={id} />;
}
