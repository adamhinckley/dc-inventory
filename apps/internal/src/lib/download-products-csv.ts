import { exportInternalProducts } from "@dc-inventory/api-client-internal";

type ExportInternalProductsParams = NonNullable<
  Parameters<typeof exportInternalProducts>[0]
>;

function filenameFromContentDisposition(
  header: string | null,
): string | undefined {
  if (!header) {
    return undefined;
  }
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1];
}

export async function downloadProductsCsv(
  params: Omit<ExportInternalProductsParams, "format">,
): Promise<void> {
  const response = await exportInternalProducts({
    ...params,
    format: "csv",
  });
  if (response.status !== 200) {
    throw new Error("Product export failed");
  }

  const filename =
    filenameFromContentDisposition(response.headers.get("content-disposition")) ??
    "products.csv";
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
