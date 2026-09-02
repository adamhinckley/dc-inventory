import type { ReactNode } from "react";
import { ReceivingDocumentWorkspace } from "../../../../components/receiving-document-workspace";

export default async function ReceivingDocumentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReceivingDocumentWorkspace purchaseOrderId={id}>
      {children}
    </ReceivingDocumentWorkspace>
  );
}
