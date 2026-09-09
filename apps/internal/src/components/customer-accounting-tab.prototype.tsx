"use client";

// PROTOTYPE — throwaway. Three variants of the customer Accounting tab
// (docs/accounting.md §10) on the existing /customers/:id route, switchable
// via `?tab=accounting&variant=A|B|C`. Mock data only; no API, no mutations.
// Question: what should the Accounting tab look like, and where does
// "Record Payment" live?

import {
  Button,
  Checkbox,
  Chip,
  DescriptionList,
  Input,
  formatMoneyMinorUnits,
} from "@dc-inventory/ui";
import {
  ArrowLeftRight,
  Ban,
  CalendarClock,
  CircleDollarSign,
  FileMinus,
  HandCoins,
  Mail,
  Plus,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PrototypeSwitcher, usePrototypeVariant } from "./prototype-switcher";

// ---------------------------------------------------------------------------
// Mock data — one customer with every awkward case on screen at once.
// ---------------------------------------------------------------------------

type InvoiceStatus = "open" | "partial" | "past_due" | "paid";
type MockInvoice = {
  id: string;
  number: string;
  posted: string;
  due: string;
  order: string;
  terms: string;
  total: number;
  remaining: number;
  status: InvoiceStatus;
  daysPastDue: number;
};
type MockPayment = {
  id: string;
  received: string;
  amount: number;
  method: string;
  reference: string;
  applied: string;
  unapplied: number;
  voided: boolean;
};

const CUR = "USD";
const invoices: MockInvoice[] = [
  { id: "i1", number: "INV-00412", posted: "2026-05-28", due: "2026-06-27", order: "SO-00891", terms: "Net 30", total: 45_50, remaining: 45_50, status: "past_due", daysPastDue: 103 },
  { id: "i2", number: "INV-00467", posted: "2026-07-02", due: "2026-08-01", order: "SO-00944", terms: "Net 30", total: 2_100_00, remaining: 2_100_00, status: "past_due", daysPastDue: 38 },
  { id: "i3", number: "INV-00489", posted: "2026-07-30", due: "2026-08-29", order: "SO-00971", terms: "Net 30", total: 1_800_00, remaining: 1_100_00, status: "past_due", daysPastDue: 10 },
  { id: "i4", number: "INV-00512", posted: "2026-08-19", due: "2026-09-18", order: "SO-01002", terms: "Net 30", total: 2_400_00, remaining: 2_400_00, status: "open", daysPastDue: 0 },
  { id: "i5", number: "INV-00371", posted: "2026-03-11", due: "2026-04-10", order: "SO-00812", terms: "Net 30", total: 1_272_00, remaining: 0, status: "paid", daysPastDue: 0 },
  { id: "i6", number: "INV-00298", posted: "2025-11-02", due: "2025-12-02", order: "SO-00701", terms: "Net 30", total: 802_05, remaining: 0, status: "paid", daysPastDue: 0 },
];
const payments: MockPayment[] = [
  { id: "p1", received: "2026-08-21", amount: 700_00, method: "check", reference: "#4471", applied: "INV-00489 $700.00", unapplied: 0, voided: false },
  { id: "p2", received: "2026-08-21", amount: 250_00, method: "ach", reference: "", applied: "—", unapplied: 250_00, voided: false },
  { id: "p3", received: "2026-08-14", amount: 5_000_00, method: "card", reference: "…4242", applied: "—", unapplied: 0, voided: true },
  { id: "p4", received: "2026-04-09", amount: 1_272_00, method: "check", reference: "#4390", applied: "INV-00371 $1,272.00", unapplied: 0, voided: false },
];
const aging = [
  { label: "Current", amount: 2_400_00 },
  { label: "1–15", amount: 1_100_00 },
  { label: "16–30", amount: 0 },
  { label: "31–45", amount: 2_100_00 },
  { label: "46–60", amount: 0 },
  { label: "61–90", amount: 0 },
  { label: "90+", amount: 45_50 },
];
const openInvoices = invoices.filter((i) => i.remaining > 0);
const sumRemaining = openInvoices.reduce((n, i) => n + i.remaining, 0);
const unappliedCredit = 250_00;
const openBalance = sumRemaining - unappliedCredit;
const pastDue = aging.slice(1).reduce((n, b) => n + b.amount, 0);
const creditLimit = 7_500_00;
const confirmedUnshipped = 1_240_00;
const availableCredit = creditLimit - (sumRemaining + confirmedUnshipped - unappliedCredit);
const plan = { amount: 1_000_00, frequency: "monthly", startsOn: "2026-08-01", next: "2026-10-01", estimatedEnd: "2027-01-01", received: 1, expected: 2 };

const stats: [string, string][] = [
  ["Highest invoice", money(2_400_00)],
  ["Avg invoice", money(1_403_26)],
  ["Open invoice count", "4"],
  ["Total invoice amount", money(8_419_55)],
  ["Credit memo count", "0"],
  ["Total CM", money(0)],
  ["Total write-offs", money(0)],
  ["Open balance", money(openBalance)],
  ["Credit limit", money(creditLimit)],
  ["Available credit", money(availableCredit)],
  ["Unapplied credit", money(unappliedCredit)],
  ["Date of first shipment", "2016-09-01"],
  ["Date of last shipment", "2026-08-19"],
  ["Date of last order", "2026-09-03"],
  ["Avg days to pay", "29"],
  ["Last YTD sales", money(4_112_00)],
  ["YTD sales", money(6_617_50)],
  ["LYTD vs YTD", "+61%"],
  ["Last year's sales", money(5_486_00)],
  ["Total sales", money(41_218_50)],
];

function money(cents: number) {
  return formatMoneyMinorUnits(cents, CUR);
}

const STATUS: Record<InvoiceStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "var(--color-info)" },
  partial: { label: "Partial", color: "var(--color-warning)" },
  past_due: { label: "Past due", color: "var(--color-error)" },
  paid: { label: "Paid", color: "var(--color-success)" },
};

function StatusChip({ status }: { status: InvoiceStatus }) {
  const p = STATUS[status];
  return (
    <Chip icon={<Chip.Dot />} style={{ "--chip-color": p.color } as CSSProperties}>
      {p.label}
    </Chip>
  );
}

function Th({ children, num }: { children: ReactNode; num?: boolean }) {
  return (
    <th className={`section-content-column-header px-section-content-x py-section-content-y ${num ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, num, className = "" }: { children: ReactNode; num?: boolean; className?: string }) {
  return (
    <td className={`px-section-content-x py-section-content-y text-body-sm tabular-nums ${num ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}

function InvoiceTable({
  rows,
  selectable,
  selected,
  onToggle,
}: {
  rows: MockInvoice[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr className="border-b border-border">
          {selectable ? <Th>{""}</Th> : null}
          <Th>Invoice</Th>
          <Th>Date</Th>
          <Th>Due</Th>
          <Th>Order</Th>
          <Th num>Amount</Th>
          <Th num>Remaining</Th>
          <Th>Terms</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((inv) => (
          <tr key={inv.id} className="border-b border-border-subtle hover:bg-surface-raised">
            {selectable ? (
              <Td>
                <Checkbox checked={selected?.has(inv.id) ?? false} onChange={() => onToggle?.(inv.id)} aria-label={`Select ${inv.number}`} />
              </Td>
            ) : null}
            <Td className="text-link">{inv.number}</Td>
            <Td>{inv.posted}</Td>
            <Td className={inv.status === "past_due" ? "text-error" : ""}>
              {inv.due}
              {inv.daysPastDue > 0 ? <span className="text-caption text-fg-tertiary"> · {inv.daysPastDue}d</span> : null}
            </Td>
            <Td className="text-link">{inv.order}</Td>
            <Td num>{money(inv.total)}</Td>
            <Td num className="font-semibold">{money(inv.remaining)}</Td>
            <Td>{inv.terms}</Td>
            <Td>
              <StatusChip status={inv.status} />
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AgingRow({ compact }: { compact?: boolean }) {
  return (
    <div className="grid grid-cols-7 gap-tight">
      {aging.map((b, i) => (
        <div
          key={b.label}
          className={`rounded-interactable border px-item-x py-item-y ${i > 0 && b.amount > 0 ? "border-error" : "border-border"}`}
        >
          <div className="text-caption text-fg-tertiary">{b.label}</div>
          <div className={`${compact ? "text-body-sm" : "text-body-emphasis"} tabular-nums`}>{money(b.amount)}</div>
        </div>
      ))}
    </div>
  );
}

function AgingBar() {
  const total = aging.reduce((n, b) => n + b.amount, 0);
  const tones = ["bg-info", "bg-warning", "bg-warning", "bg-error", "bg-error", "bg-error", "bg-[#750e13]"];
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-raised">
        {aging.map((b, i) =>
          b.amount > 0 ? (
            <div key={b.label} className={tones[i]} style={{ width: `${(b.amount / total) * 100}%` }} title={`${b.label}: ${money(b.amount)}`} />
          ) : null,
        )}
      </div>
      <div className="mt-tight flex justify-between text-caption text-fg-tertiary">
        {aging.map((b) => (
          <span key={b.label} className={b.amount > 0 ? "text-fg" : ""}>
            {b.label} <b className="tabular-nums">{b.amount > 0 ? money(b.amount) : "—"}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function PaymentsTable() {
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <Th>Received</Th>
          <Th num>Amount</Th>
          <Th>Method</Th>
          <Th>Applied to</Th>
          <Th num>Unapplied</Th>
          <Th>{""}</Th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.id} className={p.voided ? "text-fg-muted line-through" : ""}>
            <Td>{p.received}</Td>
            <Td num>{money(p.amount)}</Td>
            <Td>
              {p.method}
              {p.reference ? ` ${p.reference}` : ""}
            </Td>
            <Td>{p.voided ? "void — keyed $5,000 instead of $500" : p.applied}</Td>
            <Td num>{p.unapplied > 0 ? money(p.unapplied) : "—"}</Td>
            <Td num>
              {p.voided ? null : (
                <span className="flex justify-end gap-action">
                  <Button variant="ghost" size="sm">
                    <ArrowLeftRight className="size-icon-sm" /> Reallocate
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Ban className="size-icon-sm" /> Void
                  </Button>
                </span>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlanCard() {
  return (
    <div className="rounded-section border border-border p-card">
      <div className="flex items-start justify-between gap-region">
        <div>
          <div className="section-content-label">Payment plan</div>
          <div className="text-body-emphasis">
            {money(plan.amount)} {plan.frequency} · from {plan.startsOn}
          </div>
          <div className="text-body-sm text-fg-secondary">
            Received {plan.received} of {plan.expected} expected · next {plan.next} · est. end {plan.estimatedEnd}
          </div>
          <div className="text-body-sm text-error">1 installment missed (shown only — nothing is blocked)</div>
        </div>
        <Button variant="secondary" size="sm">
          <CalendarClock className="size-icon-sm" /> End Plan
        </Button>
      </div>
    </div>
  );
}

function StatsList({ items, heading }: { items: [string, string][]; heading?: string }) {
  return (
    <DescriptionList>
      {heading ? <DescriptionList.Heading>{heading}</DescriptionList.Heading> : null}
      {items.map(([k, v]) => (
        <DescriptionList.Item key={k}>
          <DescriptionList.Term>{k}</DescriptionList.Term>
          <DescriptionList.Data>
            <span className="tabular-nums">{v}</span>
          </DescriptionList.Data>
        </DescriptionList.Item>
      ))}
    </DescriptionList>
  );
}

function DenseStats({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-region rounded-section border border-border text-body-sm">
      {items.map(([k, v]) => (
        <div key={k} className="col-span-2 grid grid-cols-subgrid border-b border-border-subtle px-section-content-x py-item-y last:border-b-0">
          <dt className="text-fg-tertiary">{k}</dt>
          <dd className="tabular-nums font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ShowPaidToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-icon text-body-sm text-fg-secondary">
      <Checkbox checked={value} onChange={onChange} /> Show paid
    </label>
  );
}

// ---------------------------------------------------------------------------
// Variant A — Ledger. SoloView parity: grid on top, stats in two columns,
// aging + plan + statements in a right rail. Actions in a toolbar.
// ---------------------------------------------------------------------------
function VariantA() {
  const [showPaid, setShowPaid] = useState(false);
  const rows = showPaid ? invoices : openInvoices;
  return (
    <div className="flex flex-col gap-form-section">
      <div className="flex flex-wrap items-center justify-between gap-region">
        <h2 className="text-title-sm">Accounts receivable</h2>
        <div className="flex flex-wrap items-center gap-action">
          <ShowPaidToggle value={showPaid} onChange={setShowPaid} />
          <Button variant="secondary" size="sm">
            <FileMinus className="size-icon-sm" /> Adjust Invoice
          </Button>
          <Button variant="secondary" size="sm">
            <HandCoins className="size-icon-sm" /> Apply Credit
          </Button>
          <Button variant="primary" size="sm">
            <Plus className="size-icon-sm" /> Record Payment
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-section border border-border">
        <InvoiceTable rows={rows} />
      </div>
      <div className="grid gap-form-section lg:grid-cols-[1fr_1fr_minmax(280px,0.9fr)]">
        <DenseStats items={stats.slice(0, 11)} />
        <DenseStats items={stats.slice(11)} />
        <div className="flex flex-col gap-field-group">
          <div>
            <div className="section-content-label mb-tight">A/R aging (days past due)</div>
            <AgingRow compact />
          </div>
          <PlanCard />
          <div className="rounded-section border border-border p-card">
            <label className="flex items-center gap-icon text-body-sm">
              <Checkbox checked onChange={() => undefined} /> Send statements
            </label>
            <div className="mt-tight text-caption text-fg-tertiary">Last statement 2026-09-01</div>
            <Button variant="ghost" size="sm" className="mt-field">
              <Mail className="size-icon-sm" /> Send Statement
            </Button>
          </div>
        </div>
      </div>
      <div>
        <h3 className="section-content-label mb-tight">Payments</h3>
        <div className="overflow-x-auto rounded-section border border-border">
          <PaymentsTable />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant B — Balance first. Big numbers, aging as one bar, activity feed,
// all the stats folded behind a disclosure.
// ---------------------------------------------------------------------------
function VariantB() {
  const [showPaid, setShowPaid] = useState(false);
  const rows = showPaid ? invoices : openInvoices;
  const activity = useMemo(
    () =>
      [
        ...invoices.map((i) => ({ at: i.posted, kind: "invoice" as const, text: `${i.number} posted · ${money(i.total)} · ${i.terms}` })),
        ...payments.map((p) => ({ at: p.received, kind: p.voided ? ("void" as const) : ("payment" as const), text: p.voided ? `Payment ${money(p.amount)} voided — keyed wrong` : `Payment ${money(p.amount)} ${p.method} ${p.reference} → ${p.applied}${p.unapplied ? ` · ${money(p.unapplied)} held as credit` : ""}` })),
      ].sort((a, b) => (a.at < b.at ? 1 : -1)),
    [],
  );
  return (
    <div className="flex flex-col gap-form-section">
      <div className="grid gap-field-group md:grid-cols-4">
        <Kpi label="Open balance" value={money(openBalance)} note={`${money(sumRemaining)} owed − ${money(unappliedCredit)} credit`} primary />
        <Kpi label="Past due" value={money(pastDue)} tone="bad" note="3 invoices" />
        <Kpi label="Available credit" value={money(availableCredit)} tone={availableCredit < 0 ? "bad" : "ok"} note={`limit ${money(creditLimit)} · ${money(confirmedUnshipped)} confirmed unshipped`} />
        <div className="flex flex-col justify-center gap-action">
          <Button variant="primary">
            <Plus className="size-icon" /> Record Payment
          </Button>
          <Button variant="secondary">
            <HandCoins className="size-icon" /> Apply {money(unappliedCredit)} Credit
          </Button>
        </div>
      </div>
      <div className="rounded-section border border-border p-card">
        <div className="section-content-label mb-field">Aging — days past due</div>
        <AgingBar />
      </div>
      <div className="grid gap-form-section lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-field">
          <div className="flex items-center justify-between">
            <h2 className="text-title-sm">Invoices</h2>
            <ShowPaidToggle value={showPaid} onChange={setShowPaid} />
          </div>
          <div className="overflow-x-auto rounded-section border border-border">
            <InvoiceTable rows={rows} />
          </div>
        </div>
        <div className="flex flex-col gap-field-group">
          <PlanCard />
          <div>
            <h3 className="section-content-label mb-tight">Activity</h3>
            <ol className="flex flex-col divide-y divide-border-subtle rounded-section border border-border">
              {activity.map((a, i) => (
                <li key={i} className="flex gap-region px-section-content-x py-section-content-y text-body-sm">
                  <span className="w-24 shrink-0 tabular-nums text-fg-tertiary">{a.at}</span>
                  <span className={a.kind === "void" ? "text-fg-muted line-through" : a.kind === "payment" ? "text-success" : ""}>{a.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <details className="rounded-section border border-border p-card">
        <summary className="cursor-pointer text-body-emphasis">All account stats</summary>
        <div className="mt-field grid gap-form-section md:grid-cols-2">
          <StatsList items={stats.slice(0, 11)} />
          <StatsList items={stats.slice(11)} />
        </div>
      </details>
    </div>
  );
}

function Kpi({ label, value, note, tone, primary }: { label: string; value: string; note?: string; tone?: "bad" | "ok"; primary?: boolean }) {
  const color = tone === "bad" ? "text-error" : tone === "ok" ? "text-success" : "text-fg";
  return (
    <div className={`rounded-section border p-card ${primary ? "border-accent-indicator bg-surface-card-raised" : "border-border"}`}>
      <div className="section-content-stat-label">{label}</div>
      <div className={`section-content-stat-value ${color}`}>{value}</div>
      {note ? <div className="text-caption text-fg-tertiary">{note}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant C — Workbench. Two panes: invoices left, a permanently open
// Record Payment allocator right. Payment entry is the primary affordance.
// ---------------------------------------------------------------------------
function VariantC() {
  const [amount, setAmount] = useState("5000");
  const [hold, setHold] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [drawer, setDrawer] = useState<"payments" | "plan" | "stats">("payments");
  const cents = Math.round((parseFloat(amount) || 0) * 100);
  const prefill = useMemo(() => {
    let left = cents;
    const alloc: Record<string, number> = {};
    for (const inv of [...openInvoices].sort((a, b) => (a.due < b.due ? -1 : 1))) {
      const take = Math.min(left, inv.remaining);
      alloc[inv.id] = take;
      left -= take;
    }
    return { alloc, remainder: left };
  }, [cents]);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const alloc = { ...prefill.alloc, ...overrides };
  const allocated = Object.values(alloc).reduce((n, v) => n + v, 0);
  const remainder = cents - allocated;
  const balanced = cents > 0 && remainder === 0 || (remainder > 0 && hold);
  const rows = showPaid ? invoices : openInvoices;

  return (
    <div className="grid gap-form-section lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
      <div className="flex min-w-0 flex-col gap-form-section">
        <div className="flex flex-wrap items-baseline gap-region">
          <span className="text-title-sm">Open balance</span>
          <span className="section-content-stat-value">{money(openBalance)}</span>
          <span className="text-body-sm text-error">{money(pastDue)} past due</span>
          <span className="text-body-sm text-success">{money(unappliedCredit)} credit on account</span>
          <span className="ml-auto">
            <ShowPaidToggle value={showPaid} onChange={setShowPaid} />
          </span>
        </div>
        <AgingRow compact />
        <div className="overflow-x-auto rounded-section border border-border">
          <InvoiceTable rows={rows} />
        </div>
        <div>
          <div className="flex gap-tight border-b border-border">
            {(["payments", "plan", "stats"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDrawer(k)}
                className={`tab-trigger px-item-x py-item-y text-body-sm capitalize ${drawer === k ? "border-b-2 border-accent-indicator font-semibold" : "text-fg-tertiary"}`}
              >
                {k === "plan" ? "Payment plan" : k}
              </button>
            ))}
          </div>
          <div className="pt-field">
            {drawer === "payments" ? <PaymentsTable /> : null}
            {drawer === "plan" ? <PlanCard /> : null}
            {drawer === "stats" ? (
              <div className="grid gap-form-section md:grid-cols-2">
                <StatsList items={stats.slice(0, 11)} />
                <StatsList items={stats.slice(11)} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-canvas lg:self-start">
        <div className="rounded-section border border-accent-indicator bg-surface-card p-card">
          <h2 className="text-title-sm">Record payment</h2>
          <div className="mt-field grid grid-cols-2 gap-field-group">
            <label className="flex flex-col gap-field">
              <span className="form-label">Amount</span>
              <Input value={amount} onChange={(e) => { setAmount(e.target.value); setOverrides({}); }} inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-field">
              <span className="form-label">Method</span>
              <select className="text-input min-h-(--space-input-height) rounded-interactable border border-border-field bg-surface-base px-input-x">
                <option>Check</option>
                <option>Card</option>
                <option>ACH</option>
                <option>Cash</option>
              </select>
            </label>
            <label className="flex flex-col gap-field">
              <span className="form-label">Reference</span>
              <Input placeholder="check #" />
            </label>
            <label className="flex flex-col gap-field">
              <span className="form-label">Received</span>
              <Input type="date" defaultValue="2026-09-08" />
            </label>
          </div>
          <table className="mt-field-group w-full">
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th num>Remaining</Th>
                <Th num>Apply</Th>
              </tr>
            </thead>
            <tbody>
              {[...openInvoices].sort((a, b) => (a.due < b.due ? -1 : 1)).map((inv) => (
                <tr key={inv.id}>
                  <Td>
                    {inv.number}
                    <div className="text-caption text-fg-tertiary">due {inv.due}{inv.daysPastDue ? ` · ${inv.daysPastDue}d late` : ""}</div>
                  </Td>
                  <Td num>{money(inv.remaining)}</Td>
                  <Td num>
                    <Input
                      className="w-28 text-right"
                      value={((alloc[inv.id] ?? 0) / 100).toFixed(2)}
                      onChange={(e) => setOverrides({ ...overrides, [inv.id]: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                      inputMode="decimal"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-field flex items-center justify-between text-body-sm">
            <span className="text-fg-secondary">Remaining to allocate</span>
            <span className={`tabular-nums font-semibold ${remainder < 0 ? "text-error" : remainder > 0 && !hold ? "text-warning" : "text-fg"}`}>{money(remainder)}</span>
          </div>
          {remainder > 0 ? (
            <label className="mt-tight flex items-center gap-icon text-body-sm">
              <Checkbox checked={hold} onChange={setHold} /> Hold {money(remainder)} as credit on account
            </label>
          ) : null}
          {remainder < 0 ? <div className="mt-tight text-body-sm text-error">Applied more than the payment.</div> : null}
          <Button variant="primary" className="mt-field-group w-full" disabled={!balanced}>
            <CircleDollarSign className="size-icon" /> Record {cents > 0 ? money(cents) : "Payment"}
          </Button>
          <div className="mt-field flex justify-between text-caption text-fg-tertiary">
            <span>Prefilled oldest due first. Edit any Apply cell.</span>
            <button type="button" className="text-link" onClick={() => setOverrides({})}>
              Reset
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

const VARIANTS = [
  { key: "A", name: "Ledger (SoloView parity)" },
  { key: "B", name: "Balance first" },
  { key: "C", name: "Payment workbench" },
] as const;

export function CustomerAccountingTabPrototype() {
  const variant = usePrototypeVariant(VARIANTS);
  return (
    <div className="p-panel">
      <div className="mb-field rounded-interactable border border-warning bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-item-x py-item-y text-caption">
        PROTOTYPE · mock data for a fictional customer · nothing here saves · ← → to switch variants
      </div>
      {variant === "A" ? <VariantA /> : null}
      {variant === "B" ? <VariantB /> : null}
      {variant === "C" ? <VariantC /> : null}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </div>
  );
}
