"use client";

import { Button, Checkbox, TextInput } from "@dc-inventory/ui";
import { ListFilter, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { CommandPreview, type StubReopenCommand } from "./command-preview";
import {
  FAKE_SKUS,
  matchFakeSkus,
  type CatalogFilter,
  type FakeSku,
} from "./fake-catalog";
import { WindowFields } from "./window-fields";

const PAGE = 12;

export function VariantA() {
  const [filter, setFilter] = useState<CatalogFilter>({
    q: "",
    season: "spring",
    sellState: "locked",
    newOnly: false,
    excludeNeverOpen: true,
  });
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [page, setPage] = useState(0);
  const [opensAt, setOpensAt] = useState("2027-01-15");
  const [closesAt, setClosesAt] = useState("2027-03-01");
  const [command, setCommand] = useState<StubReopenCommand | null>(null);

  const matching = useMemo(() => matchFakeSkus(filter), [filter]);
  const neverOpenHidden = FAKE_SKUS.filter((row) => row.neverOpen).length;
  const slice = matching.slice(page * PAGE, page * PAGE + PAGE);

  function patch(next: Partial<CatalogFilter>) {
    setFilter((prev) => ({ ...prev, ...next }));
    setSelectAllMatching(false);
    setPage(0);
  }

  function apply() {
    const set = selectAllMatching ? matching : slice;
    const excluded = set.filter((row) => row.neverOpen).map((row) => row.sku);
    const skus = set.filter((row) => !row.neverOpen).map((row) => row.sku);
    setCommand({
      skus,
      excludedNeverOpen: excluded,
      windowOpensAt: opensAt || null,
      windowClosesAt: closesAt || null,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section pb-20">
      <p className="text-body-sm text-fg-secondary">
        Build the set with filters, then <strong>Select All Matching This Filter</strong>{" "}
        (all pages, not this page). Shared window on apply.
      </p>
      <div className="flex flex-wrap items-end gap-field-group">
        <TextInput
          density="compact"
          className="w-52 shrink-0"
          placeholder="Find SKU"
          value={filter.q}
          onChange={(value) => patch({ q: value })}
        />
        <label className="flex items-center gap-tight text-body-sm">
          Season
          <select
            className="min-h-(--space-input-height) rounded-interactable border border-border-field bg-surface-card px-input-x"
            value={filter.season}
            onChange={(event) =>
              patch({ season: event.target.value as CatalogFilter["season"] })
            }
          >
            <option value="all">All</option>
            <option value="spring">Spring</option>
            <option value="fall">Fall</option>
            <option value="yearRound">Year-Round</option>
          </select>
        </label>
        <label className="flex items-center gap-tight text-body-sm">
          Sell State
          <select
            className="min-h-(--space-input-height) rounded-interactable border border-border-field bg-surface-card px-input-x"
            value={filter.sellState}
            onChange={(event) =>
              patch({ sellState: event.target.value as CatalogFilter["sellState"] })
            }
          >
            <option value="all">All</option>
            <option value="locked">Locked</option>
            <option value="open">Open</option>
          </select>
        </label>
        <label className="flex items-center gap-tight text-body-sm">
          <Checkbox
            checked={filter.newOnly}
            onChange={(checked) => patch({ newOnly: checked === true })}
          />
          New This Pre-Sell
        </label>
        <label className="flex items-center gap-tight text-body-sm">
          <Checkbox
            checked={filter.excludeNeverOpen}
            onChange={(checked) => patch({ excludeNeverOpen: checked === true })}
          />
          Exclude Year-Round ({neverOpenHidden} flagged)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-field-group">
        <Button
          type="button"
          variant={selectAllMatching ? "primary" : "default"}
          onClick={() => setSelectAllMatching((v) => !v)}
        >
          <ListFilter />
          {selectAllMatching
            ? `Selected All ${matching.length} Matching`
            : `Select All ${matching.length} Matching This Filter`}
        </Button>
        <p className="text-body-sm text-fg-secondary">
          Showing {slice.length} of {matching.length} on this page. Select-all is the
          full filter, not the page.
        </p>
      </div>

      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className="border-b border-border text-fg-secondary">
            <th className="py-2">SKU</th>
            <th>Name</th>
            <th>Season</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {slice.map((row) => (
            <SkuRow key={row.sku} row={row} />
          ))}
        </tbody>
      </table>
      <div className="flex gap-tight">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev Page
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={(page + 1) * PAGE >= matching.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next Page
        </Button>
      </div>

      <WindowFields
        opensAt={opensAt}
        closesAt={closesAt}
        onOpensAt={setOpensAt}
        onClosesAt={setClosesAt}
      />
      <Button type="button" variant="primary" onClick={apply}>
        <RotateCcw />
        Reopen Selected For Pre-Sell
      </Button>
      <CommandPreview command={command} />
    </div>
  );
}

function SkuRow({ row }: { row: FakeSku }) {
  return (
    <tr className="border-b border-border">
      <td className="py-2 font-mono">{row.sku}</td>
      <td>{row.name}</td>
      <td>{row.season}</td>
      <td>
        {row.neverOpen ? (
          <span className="text-error">Year-round — do not reopen</span>
        ) : (
          row.sellState
        )}
      </td>
    </tr>
  );
}
