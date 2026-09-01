"use client";

import { TooltipHelp } from "@dc-inventory/ui";

export function CatalogHeading() {
  return (
    <header className="flex shrink-0 items-center gap-tight">
      <h1 className="page-title">Catalog</h1>
      <TooltipHelp
        title="Catalog"
        description="Products you sell. Inventory is updated by receiving a PO or posting an adjustment, not from this list."
        data-testid="catalog-page-help"
      />
    </header>
  );
}
