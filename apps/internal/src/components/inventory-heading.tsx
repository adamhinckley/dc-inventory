"use client";

import { TooltipHelp } from "@dc-inventory/ui";

export function InventoryHeading() {
  return (
    <header className="flex shrink-0 items-center gap-tight">
      <h1 className="page-title">Inventory</h1>
      <TooltipHelp
        title="Inventory"
        description="Stock snapshot for every catalog SKU. This list does not receive, adjust, or transfer. Receiving a PO or posting an adjustment updates these numbers."
        data-testid="inventory-page-help"
      />
    </header>
  );
}
