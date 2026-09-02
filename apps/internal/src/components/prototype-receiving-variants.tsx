"use client";

/**
 * PROTOTYPE — three structurally different Receiving layouts.
 * Question: how should inbound list + receive / cancel remaining / history look?
 * Switch with ?variant=A|B|C. Stub state only.
 */

import {
  Button,
  Checkbox,
  Chip,
  ExplorerView,
  FieldRow,
  Input,
  Label,
  LabeledField,
  TextInput,
} from "@dc-inventory/ui";
import { useMemo, useState } from "react";
import {
  cloneSeed,
  closeShort,
  isOnInboundList,
  receiveLines,
  setLineReceiveQty,
  type PrototypeInboundPo,
  type PrototypeShortNotice,
} from "../lib/prototype-receiving-store";

function ShortBanner({ notice }: { notice: PrototypeShortNotice | null }) {
  if (!notice) return null;
  if (notice.affectedCustomers.length === 0) {
    return (
      <p className="rounded-section border border-border bg-layer-01 px-region-x py-region-y text-body-sm">
        Remaining cancelled. Uncovered is 0 — nobody to chase.
      </p>
    );
  }
  return (
    <div className="rounded-section border border-border bg-layer-01 px-region-x py-region-y">
      <p className="text-body-sm">
        Short recorded. Uncovered{" "}
        {notice.uncoveredBySku
          .map((row) => `${row.sku} ${row.uncovered}`)
          .join(", ")}
        . Affected: {notice.affectedCustomers.join(", ")}.
      </p>
      <p className="mt-tight text-body-sm text-fg-secondary">
        Take care of notify / decommit off the floor —{" "}
        <span className="text-link">pointer (destination TBD)</span>
      </p>
    </div>
  );
}

function HistoryList({ po }: { po: PrototypeInboundPo }) {
  if (po.history.length === 0) {
    return <p className="text-body-sm text-fg-secondary">No receives yet.</p>;
  }
  return (
    <table className="w-full text-left text-body-sm">
      <thead>
        <tr className="text-fg-secondary">
          <th className="py-tight font-normal">When</th>
          <th className="py-tight font-normal">SKU</th>
          <th className="py-tight font-normal">Qty</th>
        </tr>
      </thead>
      <tbody>
        {po.history.map((row, i) => (
          <tr key={`${row.at}-${row.sku}-${i}`}>
            <td className="py-tight tabular-nums">{row.at}</td>
            <td className="py-tight">{row.sku}</td>
            <td className="py-tight tabular-nums">{row.qty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LineQtyFields({
  po,
  onQty,
  lines,
}: {
  po: PrototypeInboundPo;
  onQty: (lineId: string, qty: number) => void;
  lines?: PrototypeInboundPo["lines"];
}) {
  const shown = lines ?? po.lines;
  if (shown.length === 0) {
    return <p className="text-body-sm text-fg-secondary">No lines match.</p>;
  }
  return (
    <div className="flex flex-col gap-form-section">
      {shown.map((line) => (
        <FieldRow key={line.id}>
          <LabeledField className="min-w-40 flex-1">
            <Label>
              {line.sku} · remaining {line.ordered - line.received}
            </Label>
            <Input
              type="number"
              value={line.receiveQty}
              min={0}
              max={line.ordered - line.received}
              onChange={(event) =>
                onQty(line.id, Number(event.target.value) || 0)
              }
            />
          </LabeledField>
        </FieldRow>
      ))}
    </div>
  );
}

function usePrototypeReceiving() {
  const [inbound, setInbound] = useState(cloneSeed);
  const [selectedId, setSelectedId] = useState<string | null>(
    inbound[0]?.id ?? null,
  );
  const [notice, setNotice] = useState<PrototypeShortNotice | null>(null);
  const selected = useMemo(
    () => inbound.find((po) => po.id === selectedId) ?? null,
    [inbound, selectedId],
  );
  const inboundList = useMemo(
    () => inbound.filter(isOnInboundList),
    [inbound],
  );

  return {
    inbound: inboundList,
    selected,
    notice,
    select: (id: string) => {
      setSelectedId(id);
      setNotice(null);
    },
    setQty: (lineId: string, qty: number) => {
      if (!selected) return;
      setInbound(setLineReceiveQty(inbound, selected.id, lineId, qty));
    },
    receive: () => {
      if (!selected) return;
      setInbound(receiveLines(inbound, selected.id));
      setNotice(null);
    },
    closeShort: () => {
      if (!selected) return;
      const result = closeShort(inbound, selected.id);
      setInbound(result.inbound);
      setNotice(result.notice);
    },
  };
}

/** A — table first, then a full-page document (Purchasing-like explorer). */
export function VariantA() {
  const s = usePrototypeReceiving();
  const [mode, setMode] = useState<"list" | "doc">("list");
  const [lineQuery, setLineQuery] = useState("");
  const [remainingOnly, setRemainingOnly] = useState(false);

  return (
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        <p className="text-label text-fg-secondary">Receiving</p>
        <h1 className="page-title mt-1">
          {mode === "list" ? "Inbound" : s.selected?.documentNumber}
        </h1>
        <p className="page-description mt-2">
          Confirmed factory POs. Receive remaining, or cancel remaining when
          no more is coming.
        </p>
        <ShortBanner notice={s.notice} />
      </ExplorerView.Header>
      <ExplorerView.Content>
        {mode === "list" || !s.selected ? (
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="text-fg-secondary">
                <th className="py-tight font-normal">PO</th>
                <th className="py-tight font-normal">Supplier</th>
                <th className="py-tight font-normal">Ship date</th>
                <th className="py-tight font-normal">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {s.inbound.map((po) => (
                <tr key={po.id}>
                  <td className="py-tight">
                    <button
                      type="button"
                      className="text-link hover:text-link-hover"
                      onClick={() => {
                        s.select(po.id);
                        setMode("doc");
                      }}
                    >
                      {po.documentNumber}
                    </button>
                  </td>
                  <td className="py-tight">{po.supplier}</td>
                  <td className="py-tight tabular-nums">{po.shipDate}</td>
                  <td className="py-tight tabular-nums">{po.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col gap-form-section">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("list")}
            >
              Back to inbound
            </Button>
            <p className="text-body-sm text-fg-secondary">
              {s.selected.supplier} · ship {s.selected.shipDate} ·{" "}
              {s.selected.lines.length} lines
            </p>
            <TextInput
              density="compact"
              placeholder="Find SKU or name"
              value={lineQuery}
              onChange={setLineQuery}
              aria-label="Find line"
            />
            <label className="flex items-center gap-tight text-body-sm">
              <Checkbox
                data-testid="prototype-receiving-remaining-only"
                checked={remainingOnly}
                onChange={setRemainingOnly}
              />
              Remaining only
            </label>
            <LineQtyFields
              po={s.selected}
              onQty={s.setQty}
              lines={s.selected.lines.filter((line) => {
                const q = lineQuery.trim().toLowerCase();
                const match =
                  q.length === 0 ||
                  line.sku.toLowerCase().includes(q) ||
                  line.name.toLowerCase().includes(q);
                const open = line.ordered - line.received > 0;
                return match && (!remainingOnly || open);
              })}
            />
            <FieldRow>
              <Button type="button" variant="primary" onClick={s.receive}>
                Receive
              </Button>
              <Button type="button" variant="secondary" onClick={s.closeShort}>
                Cancel remaining
              </Button>
            </FieldRow>
            <h2 className="text-heading-sm">History</h2>
            <HistoryList po={s.selected} />
          </div>
        )}
      </ExplorerView.Content>
    </ExplorerView>
  );
}

/** B — dock station: inbound list stays up; receive pane on the right. */
export function VariantB() {
  const s = usePrototypeReceiving();

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-region lg:flex-row">
      <aside className="w-full shrink-0 border-border lg:w-80 lg:border-r lg:pr-region">
        <p className="text-label text-fg-secondary">Receiving</p>
        <h1 className="page-title mt-1">Dock</h1>
        <ul className="mt-region flex flex-col gap-tight">
          {s.inbound.map((po) => (
            <li key={po.id}>
              <button
                type="button"
                onClick={() => s.select(po.id)}
                className={`w-full rounded-section px-3 py-2 text-left ${
                  s.selected?.id === po.id
                    ? "bg-selected"
                    : "interactable ghost"
                }`}
              >
                <span className="block font-medium">{po.documentNumber}</span>
                <span className="text-body-sm text-fg-secondary">
                  {po.supplier} · {po.remaining} left
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="min-w-0 flex-1">
        <ShortBanner notice={s.notice} />
        {s.selected ? (
          <div className="flex flex-col gap-form-section">
            <div className="flex items-start justify-between gap-region">
              <div>
                <h2 className="page-title">{s.selected.documentNumber}</h2>
                <p className="page-description mt-1">
                  {s.selected.supplier} · {s.selected.shipDate}
                </p>
              </div>
              <Chip>{s.selected.remaining} remaining</Chip>
            </div>
            <LineQtyFields po={s.selected} onQty={s.setQty} />
            <FieldRow>
              <Button type="button" variant="primary" onClick={s.receive}>
                Receive
              </Button>
              <Button type="button" variant="secondary" onClick={s.closeShort}>
                Cancel remaining
              </Button>
            </FieldRow>
            <HistoryList po={s.selected} />
          </div>
        ) : (
          <p className="text-body-sm text-fg-secondary">Nothing inbound.</p>
        )}
      </section>
    </div>
  );
}

/** C — one PO at a time. Big receive-remaining; list is a queue, not a table. */
export function VariantC() {
  const s = usePrototypeReceiving();
  const po = s.selected;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-form-section py-region">
      <p className="text-label text-fg-secondary">Receiving queue</p>
      <p className="text-body-sm text-fg-secondary">
        {s.inbound.length} inbound
      </p>
      <ShortBanner notice={s.notice} />
      {po ? (
        <>
          <h1 className="page-title">{po.documentNumber}</h1>
          <p className="text-body-sm">
            {po.supplier}
            <br />
            Ship {po.shipDate}
          </p>
          <ul className="flex flex-col gap-field-group">
            {po.lines.map((line) => (
              <li
                key={line.id}
                className="rounded-section border border-border px-region-x py-region-y"
              >
                <p className="font-medium">{line.sku}</p>
                <p className="text-body-sm text-fg-secondary">
                  {line.received} of {line.ordered} in
                </p>
                <Label htmlFor={`c-${line.id}`} className="mt-field">
                  This receive
                </Label>
                <Input
                  id={`c-${line.id}`}
                  type="number"
                  className="mt-tight"
                  value={line.receiveQty}
                  onChange={(event) =>
                    s.setQty(line.id, Number(event.target.value) || 0)
                  }
                />
              </li>
            ))}
          </ul>
          <Button type="button" variant="primary" onClick={s.receive}>
            Receive remaining ({po.remaining})
          </Button>
          <Button type="button" variant="secondary" onClick={s.closeShort}>
            Cancel remaining
          </Button>
          <details className="text-body-sm">
            <summary>History (when, SKU, qty)</summary>
            <div className="mt-tight">
              <HistoryList po={po} />
            </div>
          </details>
          {s.inbound.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const next = s.inbound.find((row) => row.id !== po.id);
                if (next) s.select(next.id);
              }}
            >
              Skip to next PO
            </Button>
          ) : null}
        </>
      ) : (
        <p>Queue empty.</p>
      )}
    </div>
  );
}
