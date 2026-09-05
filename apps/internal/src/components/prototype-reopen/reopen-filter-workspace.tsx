"use client";

import { Button, TooltipHelp } from "@dc-inventory/ui";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { applyReopenFilters } from "./apply-reopen-filters";
import { CommandPreview, type StubReopenCommand } from "./command-preview";
import { FAKE_SKUS, type FakeSku } from "./fake-catalog";
import { reopenFilterFields } from "./reopen-filter-fields";
import {
  defaultReopenFilters,
  ResourceFilterBar,
} from "./resource-filter-bar";
import { useLocalFilters } from "./use-local-filters";
import { VirtualRows } from "./virtual-rows";
import { WindowFields } from "./window-fields";

export function ReopenFilterWorkspace() {
  const filters = useLocalFilters(defaultReopenFilters());
  const [opensAt, setOpensAt] = useState("2027-01-15");
  const [closesAt, setClosesAt] = useState("2027-03-01");
  const [command, setCommand] = useState<StubReopenCommand | null>(null);

  const matching = useMemo(
    () => applyReopenFilters(FAKE_SKUS, filters.search, filters.active),
    [filters.search, filters.active],
  );
  const reopenCount = matching.filter((row) => !row.neverOpen).length;

  function apply() {
    setCommand({
      skus: matching.filter((row) => !row.neverOpen).map((row) => row.sku),
      excludedNeverOpen: matching.filter((row) => row.neverOpen).map((row) => row.sku),
      windowOpensAt: opensAt || null,
      windowClosesAt: closesAt || null,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <header className="flex shrink-0 items-center justify-between gap-field-group">
        <div className="flex min-w-0 items-center gap-tight">
          <h1 className="page-title">Reopen For Pre-Sell (Prototype)</h1>
          <TooltipHelp
            title="Prototype"
            description="Throwaway UI for ADA-285. Filter the catalog, scroll the full match set, reopen that set. Nothing writes sell state."
          />
        </div>
        <div className="flex shrink-0 items-center gap-tight">
          <WindowFields
            opensAt={opensAt}
            closesAt={closesAt}
            onOpensAt={setOpensAt}
            onClosesAt={setClosesAt}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={apply}
          >
            <RotateCcw />
            Reopen {reopenCount.toLocaleString()} Matching
          </Button>
        </div>
      </header>
      <p className="text-body-sm text-fg-secondary">
        Filter a {FAKE_SKUS.length.toLocaleString()}-SKU catalog, scroll the full match set
        (virtualized), then reopen that set. Year-round SKUs stay skipped.
      </p>
      <ResourceFilterBar filters={filters}>
        <ResourceFilterBar.Search placeholder="Find SKU" />
        <ResourceFilterBar.Chips
          fields={reopenFilterFields}
          pinned={["sellState", "excludeNeverOpen", "active"]}
          resource="SKU"
        />
      </ResourceFilterBar>

      <p className="text-body-sm text-fg-secondary">
        {matching.length.toLocaleString()} matching of {FAKE_SKUS.length.toLocaleString()} SKUs.
      </p>

      <div className="min-h-0 overflow-hidden rounded-section border border-border">
        <div className="grid grid-cols-[8rem_1fr_8rem_8rem_6rem_5rem_5rem] gap-x-3 border-b border-border bg-surface-card px-3 py-2 text-label text-fg-secondary">
          <span>SKU</span>
          <span>Name</span>
          <span>Factory</span>
          <span>Category</span>
          <span>State</span>
          <span>On Hand</span>
          <span>On PO</span>
        </div>
        <VirtualRows
          items={matching}
          estimateSize={36}
          className="h-[min(36rem,calc(100dvh-22rem))] overflow-auto"
        >
          {(row) => <SkuRow row={row} />}
        </VirtualRows>
      </div>

      <CommandPreview command={command} />
    </div>
  );
}

function SkuRow({ row }: { row: FakeSku }) {
  return (
    <div className="grid h-full grid-cols-[8rem_1fr_8rem_8rem_6rem_5rem_5rem] items-center gap-x-3 border-b border-border px-3 text-body-sm">
      <span className="font-mono">{row.sku}</span>
      <span className="truncate">{row.name}</span>
      <span className="truncate">{row.factory}</span>
      <span className="truncate">{row.category}</span>
      <span>
        {row.neverOpen ? <span className="text-error">Year-round</span> : row.sellState}
      </span>
      <span>{row.onHand}</span>
      <span>{row.onOrder}</span>
    </div>
  );
}
