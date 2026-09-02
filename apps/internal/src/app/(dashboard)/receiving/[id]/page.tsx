import { ReceivingDocumentWorkspace } from "../../../../components/receiving-document-workspace";

export default async function ReceivingDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceivingDocumentWorkspace purchaseOrderId={id} />;
}
