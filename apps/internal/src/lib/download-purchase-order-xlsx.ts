import { exportInternalPurchaseOrder } from "@dc-inventory/api-client-internal";

function filenameFromContentDisposition(
  header: string | null,
): string | undefined {
  if (!header) {
    return undefined;
  }
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1];
}

export async function downloadPurchaseOrderXlsx(
  purchaseOrderId: string,
  fallbackDocumentNumber: string,
): Promise<void> {
  const response = await exportInternalPurchaseOrder(purchaseOrderId, {
    format: "xlsx",
  });
  if (response.status !== 200) {
    throw new Error("Purchase order export failed");
  }

  const filename =
    filenameFromContentDisposition(response.headers.get("content-disposition")) ??
    `${fallbackDocumentNumber}.xlsx`;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
