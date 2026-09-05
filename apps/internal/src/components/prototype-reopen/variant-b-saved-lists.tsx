"use client";

import { Button, Checkbox } from "@dc-inventory/ui";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { CommandPreview, type StubReopenCommand } from "./command-preview";
import { FAKE_SKUS, SAVED_LISTS } from "./fake-catalog";
import { WindowFields } from "./window-fields";

export function VariantB() {
  const [listId, setListId] = useState<(typeof SAVED_LISTS)[number]["id"]>("spring-2027");
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [opensAt, setOpensAt] = useState("2027-01-15");
  const [closesAt, setClosesAt] = useState("2027-03-01");
  const [command, setCommand] = useState<StubReopenCommand | null>(null);

  const list = SAVED_LISTS.find((row) => row.id === listId) ?? SAVED_LISTS[0];
  const rows = useMemo(
    () =>
      list.skus
        .map((sku) => FAKE_SKUS.find((row) => row.sku === sku))
        .filter((row): row is NonNullable<typeof row> => row !== undefined),
    [list],
  );

  const willReopen = rows.filter((row) => !row.neverOpen && !dropped.has(row.sku));
  const skipped = rows.filter((row) => row.neverOpen);

  function apply() {
    setCommand({
      skus: willReopen.map((row) => row.sku),
      excludedNeverOpen: skipped.map((row) => row.sku),
      windowOpensAt: opensAt || null,
      windowClosesAt: closesAt || null,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section pb-20">
      <p className="text-body-sm text-fg-secondary">
        Pick a <strong>saved list</strong> (or a trap list that includes year-round). Review
        every row on the right. Uncheck to drop from the batch. Year-round stays checked-off.
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_1fr] gap-region">
        <nav className="flex flex-col gap-tight border-r border-border pr-4">
          <p className="text-label font-semibold text-fg-secondary">Saved Lists</p>
          {SAVED_LISTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-interactable px-3 py-2 text-left text-body-sm ${
                item.id === listId
                  ? "bg-surface-raised font-semibold"
                  : "hover:bg-surface-raised"
              }`}
              onClick={() => {
                setListId(item.id);
                setDropped(new Set());
              }}
            >
              {item.name}
              <span className="mt-0.5 block text-fg-secondary">{item.skus.length} SKUs</span>
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 flex-col gap-field-group">
          <p className="text-body-sm">
            Review {rows.length} — will reopen <strong>{willReopen.length}</strong>, skip
            year-round <strong>{skipped.length}</strong>.
          </p>
          <ul className="max-h-80 overflow-auto rounded-section border border-border">
            {rows.map((row) => {
              const blocked = row.neverOpen;
              const checked = blocked ? false : !dropped.has(row.sku);
              return (
                <li
                  key={row.sku}
                  className="flex items-center gap-tight border-b border-border px-3 py-2 text-body-sm last:border-b-0"
                >
                  <Checkbox
                    checked={checked}
                    disabled={blocked}
                    onChange={(value) => {
                      setDropped((prev) => {
                        const next = new Set(prev);
                        if (value === true) {
                          next.delete(row.sku);
                        } else {
                          next.add(row.sku);
                        }
                        return next;
                      });
                    }}
                  />
                  <span className="font-mono">{row.sku}</span>
                  <span className="flex-1">{row.name}</span>
                  {blocked ? (
                    <span className="text-error">Skipped — year-round (ADA-219)</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <WindowFields
            opensAt={opensAt}
            closesAt={closesAt}
            onOpensAt={setOpensAt}
            onClosesAt={setClosesAt}
          />
          <Button type="button" variant="primary" onClick={apply}>
            <RotateCcw />
            Reopen Reviewed List
          </Button>
        </div>
      </div>
      <CommandPreview command={command} />
    </div>
  );
}
