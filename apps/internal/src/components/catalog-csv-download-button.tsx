"use client";

import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import { Button } from "@dc-inventory/ui";
import { Download } from "lucide-react";
import { useState } from "react";
import { downloadProductsCsv } from "../lib/download-products-csv";
import { listParamsFromSearchParams } from "../lib/table-url-params";

export function CatalogCsvDownloadButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setError(null);
    setPending(true);
    try {
      const params = listParamsFromSearchParams(
        listInternalProductsTable,
        Object.fromEntries(new URLSearchParams(window.location.search)),
      );
      await downloadProductsCsv({
        q: typeof params.q === "string" ? params.q : undefined,
        sortBy:
          params.sortBy === "sku" ||
          params.sortBy === "name" ||
          params.sortBy === "onHand" ||
          params.sortBy === "available" ||
          params.sortBy === "caseQty" ||
          params.sortBy === "createdAt"
            ? params.sortBy
            : undefined,
        sortOrder: params.sortOrder === "desc" ? "desc" : params.sortOrder === "asc" ? "asc" : undefined,
        inactive: typeof params.inactive === "boolean" ? params.inactive : undefined,
      });
    } catch {
      setError("Download failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        onClick={() => void onDownload()}
        disabled={pending}
        data-testid="catalog-download-csv"
      >
        <Download className="size-icon-lg" aria-hidden />
        {pending ? "Downloading…" : "Download CSV"}
      </Button>
      {error ? (
        <p className="text-label text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
