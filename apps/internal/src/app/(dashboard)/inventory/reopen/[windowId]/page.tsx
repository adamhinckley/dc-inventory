import { SellWindowEditorPage } from "../../../../../prototype/sell-windows/pages/window-editor-page";

export default async function InventoryReopenWindowPage({
  params,
}: {
  params: Promise<{ windowId: string }>;
}) {
  const { windowId } = await params;
  return <SellWindowEditorPage windowId={windowId} />;
}
