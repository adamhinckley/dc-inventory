"use client";

import { TooltipHelp } from "@dc-inventory/ui";

export function CatalogHeading() {
  return (
    <header className="flex shrink-0 items-center gap-tight">
      <h1 className="page-title">Catalog</h1>
      <TooltipHelp
        title="Catalog"
        description="Staff product list from the internal API. Quantities are displayed as returned. This page does not write inventory."
        data-testid="catalog-page-help"
      />
    </header>
  );
}
