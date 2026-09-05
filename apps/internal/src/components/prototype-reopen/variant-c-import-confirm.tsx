"use client";

import { Button, Label, LabeledField } from "@dc-inventory/ui";
import { ClipboardPaste, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { CommandPreview, type StubReopenCommand } from "./command-preview";
import { FAKE_SKUS } from "./fake-catalog";
import { WindowFields } from "./window-fields";

const SAMPLE = `DC-SP-001
DC-SP-002
DC-YR-001
DC-YR-002
DC-FA-001
NOT-A-SKU`;

export function VariantC() {
  const [paste, setPaste] = useState(SAMPLE);
  const [stage, setStage] = useState<"paste" | "confirm">("paste");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [noWindow, setNoWindow] = useState(true);
  const [command, setCommand] = useState<StubReopenCommand | null>(null);

  const parsed = useMemo(() => {
    const tokens = paste
      .split(/[\s,;]+/)
      .map((token) => token.trim().toUpperCase())
      .filter((token) => token.length > 0);
    const unique = [...new Set(tokens)];
    const known = unique
      .map((sku) => FAKE_SKUS.find((row) => row.sku === sku))
      .filter((row): row is NonNullable<typeof row> => row !== undefined);
    const unknown = unique.filter((sku) => !FAKE_SKUS.some((row) => row.sku === sku));
    const reopen = known.filter((row) => !row.neverOpen);
    const skipped = known.filter((row) => row.neverOpen);
    return { unique, unknown, reopen, skipped };
  }, [paste]);

  function apply() {
    setCommand({
      skus: parsed.reopen.map((row) => row.sku),
      excludedNeverOpen: parsed.skipped.map((row) => row.sku),
      windowOpensAt: noWindow ? null : opensAt || null,
      windowClosesAt: noWindow ? null : closesAt || null,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section pb-20">
      <p className="text-body-sm text-fg-secondary">
        No browse table. Staff <strong>paste SKUs</strong> (spreadsheet / email), then confirm
        what will reopen vs skip. Window is optional for the whole batch.
      </p>

      {stage === "paste" ? (
        <>
          <LabeledField>
            <Label htmlFor="sku-paste">SKU List</Label>
            <textarea
              id="sku-paste"
              className="min-h-48 w-full rounded-interactable border border-border-field bg-surface-card p-3 font-mono text-body-sm"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
            />
          </LabeledField>
          <Button type="button" variant="primary" onClick={() => setStage("confirm")}>
            <ClipboardPaste />
            Review Paste
          </Button>
        </>
      ) : (
        <>
          <div className="grid gap-region md:grid-cols-2">
            <section className="rounded-section border border-border p-4">
              <h2 className="text-heading font-semibold">Will Reopen ({parsed.reopen.length})</h2>
              <ul className="mt-2 max-h-56 overflow-auto text-body-sm">
                {parsed.reopen.map((row) => (
                  <li key={row.sku} className="font-mono">
                    {row.sku} — {row.name}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-section border border-error p-4">
              <h2 className="text-heading font-semibold">Skipped</h2>
              <p className="text-body-sm text-fg-secondary">Year-round pending ADA-219</p>
              <ul className="mt-2 max-h-32 overflow-auto text-body-sm">
                {parsed.skipped.map((row) => (
                  <li key={row.sku} className="font-mono text-error">
                    {row.sku} — {row.name}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-body-sm text-fg-secondary">Unknown tokens</p>
              <ul className="font-mono text-body-sm">
                {parsed.unknown.map((sku) => (
                  <li key={sku}>{sku}</li>
                ))}
              </ul>
            </section>
          </div>
          <label className="flex items-center gap-tight text-body-sm">
            <input
              type="checkbox"
              checked={noWindow}
              onChange={(event) => setNoWindow(event.target.checked)}
            />
            No Sell Window — open until first factory PO
          </label>
          {noWindow ? null : (
            <WindowFields
              opensAt={opensAt}
              closesAt={closesAt}
              onOpensAt={setOpensAt}
              onClosesAt={setClosesAt}
            />
          )}
          <div className="flex flex-wrap gap-field-group">
            <Button type="button" variant="default" onClick={() => setStage("paste")}>
              <ClipboardPaste />
              Back To Paste
            </Button>
            <Button type="button" variant="primary" onClick={apply}>
              <RotateCcw />
              Confirm Reopen
            </Button>
          </div>
        </>
      )}
      <CommandPreview command={command} />
    </div>
  );
}
