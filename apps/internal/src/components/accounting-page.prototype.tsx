"use client";

// PROTOTYPE — throwaway. Two variants of the business-wide /accounting AR page
// (docs/accounting.md §11) on the existing /accounting route, switchable via
// `?variant=A|B`. Mock data only; no API, no mutations.
// Question: tabs (A) or one scroll with a cash-in rail (B)? Does the as-of
// picker earn its place? Is the KPI strip the right four numbers?
//
// The mock ledger below is projected for `asOf` the way §3 says the real read
// model will be (postedAt / received_at / created_at ≤ asOf; voids ignored at
// every asOf), so moving the date changes every number on the page.

import {
  Button,
  Chip,
  DateInput,
  RouterTabs,
  Table,
  TextInput,
  formatMoneyMinorUnits,
  useTable,
  type TableColumnDef,
} from "@dc-inventory/ui";
import { CalendarDays, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PrototypeSwitcher, usePrototypeVariant } from "./prototype-switcher";

// ---------------------------------------------------------------------------
// Mock ledger — 14 customers, every awkward case on screen at once.
// ---------------------------------------------------------------------------

const TODAY = "2026-09-08";
const CUR = "USD";

type Cust = {
  id: string;
  number: string;
  name: string;
  city: string;
  creditLimit: number;
  confirmedUnshipped: number;
  plan: boolean;
};
type Inv = { id: string; number: string; customerId: string; posted: string; due: string; total: number };
type Pay = {
  id: string;
  customerId: string;
  received: string;
  amount: number;
  method: "check" | "card" | "ach" | "cash" | "other";
  reference: string;
  applications: { invoiceId: string; amount: number }[];
  voided?: boolean;
};
type Adj = { id: string; invoiceId: string; kind: "write_off" | "credit_memo"; amount: number; created: string };

const customers: Cust[] = [
  { id: "c1", number: "100076", name: "Al's Flowers", city: "Montgomery, AL", creditLimit: 0, confirmedUnshipped: 0, plan: false },
  { id: "c2", number: "100112", name: "Bloom & Vine Florist", city: "Birmingham, AL", creditLimit: 750_000, confirmedUnshipped: 124_000, plan: false },
  { id: "c3", number: "100205", name: "Petal Pushers", city: "Mobile, AL", creditLimit: 500_000, confirmedUnshipped: 0, plan: false },
  { id: "c4", number: "100231", name: "Magnolia Home & Garden", city: "Atlanta, GA", creditLimit: 1_500_000, confirmedUnshipped: 312_500, plan: false },
  { id: "c5", number: "100288", name: "Southern Charm Gifts", city: "Savannah, GA", creditLimit: 1_000_000, confirmedUnshipped: 0, plan: true },
  { id: "c6", number: "100301", name: "Rosewood Interiors", city: "Nashville, TN", creditLimit: 2_000_000, confirmedUnshipped: 480_000, plan: false },
  { id: "c7", number: "100344", name: "The Potting Shed", city: "Chattanooga, TN", creditLimit: 300_000, confirmedUnshipped: 95_000, plan: false },
  { id: "c8", number: "100367", name: "Coastal Blooms", city: "Pensacola, FL", creditLimit: 800_000, confirmedUnshipped: 0, plan: false },
  { id: "c9", number: "100402", name: "Ivy & Oak Boutique", city: "Charleston, SC", creditLimit: 600_000, confirmedUnshipped: 0, plan: false },
  { id: "c10", number: "100419", name: "Gulf Coast Garden Center", city: "Gulfport, MS", creditLimit: 1_200_000, confirmedUnshipped: 210_000, plan: false },
  { id: "c11", number: "100455", name: "Dixie Floral Supply", city: "Jackson, MS", creditLimit: 2_500_000, confirmedUnshipped: 640_000, plan: true },
  { id: "c12", number: "100480", name: "Bluegrass Blooms", city: "Lexington, KY", creditLimit: 400_000, confirmedUnshipped: 0, plan: false },
  { id: "c13", number: "100503", name: "Lowcountry Living", city: "Beaufort, SC", creditLimit: 250_000, confirmedUnshipped: 60_000, plan: false },
  { id: "c14", number: "100521", name: "Prairie Rose Mercantile", city: "Tulsa, OK", creditLimit: 900_000, confirmedUnshipped: 0, plan: false },
];

// [customer, invoice #, posted, due, total cents]
const invoiceRows: [string, string, string, string, number][] = [
  ["c1", "INV-00371", "2026-03-11", "2026-04-10", 127_200],
  ["c1", "INV-00512", "2026-08-19", "2026-09-18", 240_000],
  ["c2", "INV-00467", "2026-07-02", "2026-08-01", 210_000],
  ["c2", "INV-00530", "2026-08-25", "2026-09-24", 388_500],
  ["c3", "INV-00412", "2026-04-27", "2026-05-27", 4_550],
  ["c3", "INV-00519", "2026-08-21", "2026-09-20", 96_300],
  ["c4", "INV-00489", "2026-07-30", "2026-08-29", 1_180_000],
  ["c4", "INV-00527", "2026-08-24", "2026-09-23", 742_000],
  ["c4", "INV-00541", "2026-09-04", "2026-10-04", 315_800],
  ["c5", "INV-00431", "2026-06-05", "2026-07-05", 620_000],
  ["c5", "INV-00458", "2026-06-26", "2026-07-26", 180_000],
  ["c6", "INV-00533", "2026-08-27", "2026-09-26", 1_640_000],
  ["c6", "INV-00544", "2026-09-06", "2026-10-06", 528_000],
  ["c7", "INV-00498", "2026-08-10", "2026-08-19", 282_400],
  ["c7", "INV-00538", "2026-09-01", "2026-09-10", 61_000],
  ["c8", "INV-00505", "2026-08-12", "2026-09-11", 455_000],
  ["c9", "INV-00476", "2026-07-15", "2026-07-20", 173_500],
  ["c10", "INV-00445", "2026-06-15", "2026-07-15", 812_000],
  ["c10", "INV-00536", "2026-08-30", "2026-09-29", 297_000],
  ["c11", "INV-00471", "2026-07-09", "2026-07-29", 2_150_000],
  ["c11", "INV-00520", "2026-08-21", "2026-09-20", 995_000],
  ["c12", "INV-00509", "2026-08-13", "2026-08-28", 148_200],
  ["c13", "INV-00542", "2026-09-05", "2026-10-05", 43_750],
  ["c14", "INV-00493", "2026-08-03", "2026-08-18", 356_000],
  ["c14", "INV-00539", "2026-09-02", "2026-10-02", 122_000],
];
const invoices: Inv[] = invoiceRows.map(([customerId, number, posted, due, total]) => ({
  id: number,
  number,
  customerId,
  posted,
  due,
  total,
}));

const payments: Pay[] = [
  { id: "p01", customerId: "c1", received: "2026-04-09", amount: 127_200, method: "check", reference: "#4390", applications: [{ invoiceId: "INV-00371", amount: 127_200 }] },
  { id: "p02", customerId: "c1", received: "2026-08-21", amount: 25_000, method: "ach", reference: "", applications: [] }, // held as credit
  { id: "p03", customerId: "c4", received: "2026-08-14", amount: 500_000, method: "check", reference: "#2231", applications: [{ invoiceId: "INV-00489", amount: 500_000 }] },
  { id: "p04", customerId: "c8", received: "2026-09-03", amount: 455_000, method: "ach", reference: "TXN-88120", applications: [{ invoiceId: "INV-00505", amount: 455_000 }] },
  { id: "p05", customerId: "c11", received: "2026-08-05", amount: 1_000_000, method: "check", reference: "#7712", applications: [{ invoiceId: "INV-00471", amount: 1_000_000 }] },
  { id: "p06", customerId: "c11", received: "2026-09-01", amount: 500_000, method: "check", reference: "#7740", applications: [{ invoiceId: "INV-00471", amount: 500_000 }] },
  { id: "p07", customerId: "c5", received: "2026-08-01", amount: 100_000, method: "ach", reference: "plan 1/8", applications: [{ invoiceId: "INV-00431", amount: 100_000 }] },
  { id: "p08", customerId: "c5", received: "2026-09-01", amount: 100_000, method: "ach", reference: "plan 2/8", applications: [{ invoiceId: "INV-00431", amount: 100_000 }] },
  { id: "p09", customerId: "c14", received: "2026-08-14", amount: 3_560_000, method: "card", reference: "…4242", applications: [], voided: true }, // keyed $35,600 not $3,560
  { id: "p10", customerId: "c14", received: "2026-08-14", amount: 356_000, method: "card", reference: "…4242", applications: [{ invoiceId: "INV-00493", amount: 200_000 }] }, // partial, rest held
  { id: "p11", customerId: "c10", received: "2026-07-20", amount: 800_000, method: "check", reference: "#1180", applications: [{ invoiceId: "INV-00445", amount: 800_000 }] },
  { id: "p12", customerId: "c12", received: "2026-09-08", amount: 50_000, method: "cash", reference: "", applications: [{ invoiceId: "INV-00509", amount: 50_000 }] },
  { id: "p13", customerId: "c6", received: "2026-09-08", amount: 640_000, method: "ach", reference: "TXN-90417", applications: [{ invoiceId: "INV-00533", amount: 640_000 }] },
  { id: "p14", customerId: "c2", received: "2026-09-08", amount: 100_000, method: "check", reference: "#5521", applications: [{ invoiceId: "INV-00467", amount: 100_000 }] },
  { id: "p15", customerId: "c9", received: "2026-08-28", amount: 50_000, method: "check", reference: "#3302", applications: [{ invoiceId: "INV-00476", amount: 50_000 }] },
  { id: "p16", customerId: "c7", received: "2026-09-05", amount: 80_000, method: "ach", reference: "TXN-89901", applications: [{ invoiceId: "INV-00498", amount: 80_000 }] },
];

const adjustments: Adj[] = [
  { id: "a1", invoiceId: "INV-00445", kind: "write_off", amount: 12_000, created: "2026-09-02" }, // Gulf Coast short-pay
  { id: "a2", invoiceId: "INV-00476", kind: "credit_memo", amount: 23_500, created: "2026-08-30" }, // damaged carton
];

// ---------------------------------------------------------------------------
// Projection for asOf (mirrors §3 — the only math on the page, and it is mock).
// ---------------------------------------------------------------------------

const BUCKETS = ["Current", "1–15", "16–30", "31–45", "46–60", "61–90", "90+"] as const;
type Bucket = (typeof BUCKETS)[number];

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
function bucketFor(daysPastDue: number): Bucket {
  if (daysPastDue <= 0) return "Current";
  if (daysPastDue <= 15) return "1–15";
  if (daysPastDue <= 30) return "16–30";
  if (daysPastDue <= 45) return "31–45";
  if (daysPastDue <= 60) return "46–60";
  if (daysPastDue <= 90) return "61–90";
  return "90+";
}
function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

type CustomerRow = {
  id: string;
  number: string;
  name: string;
  city: string;
  openBalance: number;
  pastDue: number;
  oldestDue: string | null;
  daysPastDue: number;
  creditLimit: number;
  availableCredit: number;
  unapplied: number;
  plan: boolean;
  buckets: Record<Bucket, number>;
};
type PaymentRow = {
  id: string;
  received: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: string;
  reference: string;
  applied: number;
  unapplied: number;
  voided: boolean;
};
type Projection = {
  openAr: number;
  pastDue: number;
  unappliedTotal: number;
  mtdWriteOffs: number;
  aging: Record<Bucket, number>;
  customerRows: CustomerRow[];
  paymentRows: PaymentRow[];
};

function project(asOf: string): Projection {
  const livePayments = payments.filter((p) => !p.voided && p.received <= asOf);
  const appliedTo = new Map<string, number>();
  for (const p of livePayments) for (const a of p.applications) appliedTo.set(a.invoiceId, (appliedTo.get(a.invoiceId) ?? 0) + a.amount);
  const adjustedTo = new Map<string, number>();
  for (const a of adjustments) if (a.created <= asOf) adjustedTo.set(a.invoiceId, (adjustedTo.get(a.invoiceId) ?? 0) + a.amount);

  const emptyBuckets = (): Record<Bucket, number> => ({ Current: 0, "1–15": 0, "16–30": 0, "31–45": 0, "46–60": 0, "61–90": 0, "90+": 0 });
  const aging = emptyBuckets();
  const perCustomer = new Map<string, CustomerRow>();
  for (const c of customers) {
    perCustomer.set(c.id, {
      id: c.id,
      number: c.number,
      name: c.name,
      city: c.city,
      openBalance: 0,
      pastDue: 0,
      oldestDue: null,
      daysPastDue: 0,
      creditLimit: c.creditLimit,
      availableCredit: 0,
      unapplied: 0,
      plan: c.plan,
      buckets: emptyBuckets(),
    });
  }

  let openAr = 0;
  let pastDue = 0;
  for (const inv of invoices) {
    if (inv.posted > asOf) continue;
    const remaining = inv.total - (appliedTo.get(inv.id) ?? 0) - (adjustedTo.get(inv.id) ?? 0);
    if (remaining <= 0) continue;
    const row = perCustomer.get(inv.customerId)!;
    const dpd = daysBetween(inv.due, asOf);
    const bucket = bucketFor(dpd);
    aging[bucket] += remaining;
    row.buckets[bucket] += remaining;
    row.openBalance += remaining;
    openAr += remaining;
    if (dpd > 0) {
      row.pastDue += remaining;
      pastDue += remaining;
      row.daysPastDue = Math.max(row.daysPastDue, dpd);
    }
    if (row.oldestDue === null || inv.due < row.oldestDue) row.oldestDue = inv.due;
  }

  let unappliedTotal = 0;
  for (const p of livePayments) {
    const unapplied = p.amount - p.applications.reduce((n, a) => n + a.amount, 0);
    if (unapplied > 0) {
      perCustomer.get(p.customerId)!.unapplied += unapplied;
      unappliedTotal += unapplied;
    }
  }

  for (const c of customers) {
    const row = perCustomer.get(c.id)!;
    const exposure = row.openBalance + c.confirmedUnshipped - row.unapplied;
    row.availableCredit = c.creditLimit - exposure;
    row.openBalance -= row.unapplied;
  }

  const mtdWriteOffs = adjustments
    .filter((a) => a.kind === "write_off" && a.created >= monthStart(asOf) && a.created <= asOf)
    .reduce((n, a) => n + a.amount, 0);

  const byId = new Map(customers.map((c) => [c.id, c] as const));
  const paymentRows: PaymentRow[] = payments
    .filter((p) => p.received <= asOf)
    .map((p) => {
      const applied = p.applications.reduce((n, a) => n + a.amount, 0);
      return {
        id: p.id,
        received: p.received,
        customerId: p.customerId,
        customerName: byId.get(p.customerId)!.name,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        applied: p.voided ? 0 : applied,
        unapplied: p.voided ? 0 : p.amount - applied,
        voided: p.voided === true,
      };
    })
    .sort((a, b) => (a.received < b.received ? 1 : a.received > b.received ? -1 : 0));

  return {
    openAr,
    pastDue,
    unappliedTotal,
    mtdWriteOffs,
    aging,
    customerRows: [...perCustomer.values()].filter((r) => r.openBalance > 0 || r.unapplied > 0),
    paymentRows,
  };
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function money(cents: number) {
  return formatMoneyMinorUnits(cents, CUR);
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}
function pct(part: number, whole: number) {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}
function customerTabHref(id: string) {
  return `/customers/${id}?tab=accounting`;
}

type Params = {
  asOf: string;
  bucket: Bucket | null;
  tab: "balances" | "payments";
  range: "today" | "mtd" | "custom";
  from: string;
  to: string;
  q: string;
};

function useParams(): [Params, (patch: Partial<Record<keyof Params, string | null>>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const asOf = searchParams.get("asOf") ?? TODAY;
  const rawBucket = searchParams.get("bucket");
  const params: Params = {
    asOf,
    bucket: BUCKETS.includes(rawBucket as Bucket) ? (rawBucket as Bucket) : null,
    tab: searchParams.get("tab") === "payments" ? "payments" : "balances",
    range: (["today", "mtd", "custom"] as const).find((r) => r === searchParams.get("range")) ?? "mtd",
    from: searchParams.get("from") ?? monthStart(asOf),
    to: searchParams.get("to") ?? asOf,
    q: searchParams.get("q") ?? "",
  };
  const set = useCallback(
    (patch: Partial<Record<keyof Params, string | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  return [params, set];
}

function Header({ asOf, onAsOf }: { asOf: string; onAsOf: (v: string | null) => void }) {
  const isToday = asOf === TODAY;
  return (
    <header className="mt-2 flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-label text-fg-secondary">Accounting</p>
        <h1 className="page-title mt-1">Accounts receivable</h1>
        <p className="page-description mt-2">
          Who owes us, who is late, what came in. Payments, credits, and adjustments are recorded on the customer.
        </p>
      </div>
      <div className="flex shrink-0 items-end gap-field-group">
        <div className="flex flex-col gap-field">
          <span className="text-label text-fg-secondary">As of</span>
          <div className="flex items-center gap-action">
            <DateInput density="compact" value={asOf} max={TODAY} onChange={(v) => onAsOf(v === TODAY ? null : v)} className="w-52 shrink-0" data-testid="accounting-asof" />
            {!isToday ? (
              <Button variant="ghost" size="sm" onClick={() => onAsOf(null)}>
                <CalendarDays className="size-icon-sm" /> Today
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: "error" | "warning" }) {
  return (
    <div className="rounded-section border border-border p-card">
      <div className="section-content-label">{label}</div>
      <div className={`mt-tight text-title-lg tabular-nums ${tone === "error" ? "text-error" : tone === "warning" ? "text-warning" : ""}`}>{value}</div>
      {sub ? <div className="mt-tight text-body-sm text-fg-secondary">{sub}</div> : null}
    </div>
  );
}

function KpiStrip({ p }: { p: Projection }) {
  return (
    <div className="grid grid-cols-2 gap-tight lg:grid-cols-4">
      <Tile label="Total open AR" value={money(p.openAr)} sub={`${p.customerRows.filter((r) => r.openBalance > 0).length} customers with a balance`} />
      <Tile label="Past due" value={money(p.pastDue)} sub={`${pct(p.pastDue, p.openAr)} of open AR`} tone={p.pastDue > 0 ? "error" : undefined} />
      <Tile label="Unapplied credit" value={money(p.unappliedTotal)} sub="Held on customers, not yet applied" />
      <Tile label="MTD write-offs" value={money(p.mtdWriteOffs)} sub="Bad debt this month" />
    </div>
  );
}

function AgingStrip({ p, active, onPick }: { p: Projection; active: Bucket | null; onPick: (b: Bucket | null) => void }) {
  return (
    <div className="grid grid-cols-7 gap-tight">
      {BUCKETS.map((b, i) => {
        const amount = p.aging[b];
        const isActive = active === b;
        const late = i > 0 && amount > 0;
        return (
          <button
            key={b}
            type="button"
            onClick={() => onPick(isActive ? null : b)}
            aria-pressed={isActive}
            className={`rounded-interactable border px-item-x py-item-y text-left transition-colors hover:bg-surface-raised ${
              isActive ? "border-fg bg-surface-raised" : late ? "border-error" : "border-border"
            }`}
          >
            <div className="text-caption text-fg-tertiary">{b}</div>
            <div className={`text-body-emphasis tabular-nums ${amount === 0 ? "text-fg-muted" : ""}`}>{amount === 0 ? "—" : money(amount)}</div>
            <div className="text-caption text-fg-tertiary">{amount === 0 ? "" : pct(amount, p.openAr)}</div>
          </button>
        );
      })}
    </div>
  );
}

function AgingBar({ p, active, onPick }: { p: Projection; active: Bucket | null; onPick: (b: Bucket | null) => void }) {
  const tones = ["bg-info", "bg-warning", "bg-warning", "bg-error", "bg-error", "bg-error", "bg-[#750e13]"];
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-raised">
        {BUCKETS.map((b, i) =>
          p.aging[b] > 0 ? (
            <button
              key={b}
              type="button"
              onClick={() => onPick(active === b ? null : b)}
              className={`${tones[i]} ${active && active !== b ? "opacity-30" : ""} transition-opacity`}
              style={{ width: `${(p.aging[b] / p.openAr) * 100}%` }}
              title={`${b}: ${money(p.aging[b])}`}
              aria-label={`${b}: ${money(p.aging[b])}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-tight grid grid-cols-7 gap-tight text-caption">
        {BUCKETS.map((b, i) => (
          <button
            key={b}
            type="button"
            onClick={() => onPick(active === b ? null : b)}
            className={`flex items-center gap-icon rounded-interactable px-1 text-left hover:bg-surface-raised ${active === b ? "bg-surface-raised" : ""}`}
          >
            <span className={`size-2 shrink-0 rounded-full ${tones[i]}`} />
            <span className={p.aging[b] > 0 ? "text-fg" : "text-fg-muted"}>
              {b} <b className="tabular-nums">{p.aging[b] > 0 ? money(p.aging[b]) : "—"}</b>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanChip() {
  return (
    <Chip icon={<Chip.Dot />} style={{ "--chip-color": "var(--color-info)" } as CSSProperties}>
      Plan
    </Chip>
  );
}

type Sort = { field: string | null; direction: "asc" | "desc" };

function BalancesTable({ rows, bucket, q, onQ }: { rows: CustomerRow[]; bucket: Bucket | null; q: string; onQ: (v: string) => void }) {
  const [sort, setSort] = useState<Sort>({ field: "pastDue", direction: "desc" });
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (bucket ? r.buckets[bucket] > 0 : true) && (needle ? r.name.toLowerCase().includes(needle) || r.number.includes(needle) : true));
  }, [rows, bucket, q]);

  const columns = useMemo<TableColumnDef<CustomerRow>[]>(
    () => [
      {
        id: "name",
        label: "Customer",
        sort: "name",
        flex: 1,
        minWidth: 220,
        truncate: true,
        render: ({ record }) => (
          <Link href={customerTabHref(record.id)} className="text-link hover:text-link-hover block min-w-0 truncate">
            <span className="font-medium">{record.name}</span>
            <span className="text-fg-tertiary"> · {record.number}</span>
          </Link>
        ),
      },
      { id: "openBalance", label: "Open balance", sort: "openBalance", align: "right", width: 140, render: ({ record }) => <span className="font-semibold tabular-nums">{money(record.openBalance)}</span> },
      {
        id: "pastDue",
        label: "Past due",
        sort: "pastDue",
        align: "right",
        width: 140,
        render: ({ record }) => <span className={`tabular-nums ${record.pastDue > 0 ? "text-error" : "text-fg-muted"}`}>{record.pastDue > 0 ? money(record.pastDue) : "—"}</span>,
      },
      { id: "oldestDue", label: "Oldest due", sort: "oldestDue", width: 120, render: ({ record }) => fmtDate(record.oldestDue) },
      {
        id: "daysPastDue",
        label: "Days late",
        sort: "daysPastDue",
        align: "right",
        width: 96,
        render: ({ record }) => <span className={`tabular-nums ${record.daysPastDue > 30 ? "text-error" : ""}`}>{record.daysPastDue > 0 ? record.daysPastDue : "—"}</span>,
      },
      { id: "creditLimit", label: "Credit limit", sort: "creditLimit", align: "right", width: 120, render: ({ record }) => <span className="tabular-nums">{record.creditLimit === 0 ? "No credit" : money(record.creditLimit)}</span> },
      {
        id: "availableCredit",
        label: "Available",
        sort: "availableCredit",
        align: "right",
        width: 130,
        render: ({ record }) => <span className={`tabular-nums ${record.availableCredit < 0 ? "text-error font-medium" : ""}`}>{money(record.availableCredit)}</span>,
      },
      {
        id: "flags",
        label: "",
        sort: false,
        width: 150,
        render: ({ record }) => (
          <span className="flex gap-tight">
            {record.plan ? <PlanChip /> : null}
            {record.unapplied > 0 ? (
              <Chip icon={<Chip.Dot />} style={{ "--chip-color": "var(--color-success)" } as CSSProperties}>
                Credit {money(record.unapplied)}
              </Chip>
            ) : null}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useTable({
    data: filtered,
    columns,
    getRowId: (r) => r.id,
    fillColumn: "name",
    enableSorting: true,
    enablePagination: false,
    sort,
    onSortChange: setSort,
    defaultSortField: "pastDue",
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <div className="flex items-center justify-between gap-region">
        <TextInput density="compact" placeholder="Find customer" value={q} onChange={onQ} className="w-52 shrink-0" icon={<Search className="size-icon-sm" />} />
        <p className="text-body-sm text-fg-secondary">
          {filtered.length} of {rows.length} customers{bucket ? ` · in ${bucket}` : ""} · {money(filtered.reduce((n, r) => n + r.openBalance, 0))} open
        </p>
      </div>
      <Table sticky className="min-h-0 flex-1" table={table} emptyMessage="No customers with a balance">
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>
    </div>
  );
}

function PaymentsTable({ p, params, set }: { p: Projection; params: Params; set: ReturnType<typeof useParams>[1] }) {
  const from = params.range === "today" ? params.asOf : params.range === "mtd" ? monthStart(params.asOf) : params.from;
  const to = params.range === "custom" ? params.to : params.asOf;
  const rows = useMemo(() => p.paymentRows.filter((r) => r.received >= from && r.received <= to), [p, from, to]);
  const total = rows.filter((r) => !r.voided).reduce((n, r) => n + r.amount, 0);

  const columns = useMemo<TableColumnDef<PaymentRow>[]>(
    () => [
      { id: "received", label: "Received", sort: "received", width: 120, render: ({ record }) => fmtDate(record.received) },
      {
        id: "customerName",
        label: "Customer",
        sort: "customerName",
        flex: 1,
        minWidth: 200,
        truncate: true,
        render: ({ record }) => (
          <Link href={customerTabHref(record.customerId)} className="text-link hover:text-link-hover block min-w-0 truncate font-medium">
            {record.customerName}
          </Link>
        ),
      },
      { id: "amount", label: "Amount", sort: "amount", align: "right", width: 130, render: ({ record }) => <span className={`tabular-nums font-semibold ${record.voided ? "line-through text-fg-muted" : ""}`}>{money(record.amount)}</span> },
      { id: "method", label: "Method", sort: "method", width: 90 },
      { id: "reference", label: "Reference", sort: false, width: 130, render: ({ record }) => record.reference || <span className="text-fg-muted">—</span> },
      {
        id: "applied",
        label: "Applied / unapplied",
        sort: false,
        align: "right",
        width: 180,
        render: ({ record }) =>
          record.voided ? (
            <span className="text-fg-muted">—</span>
          ) : (
            <span className="tabular-nums">
              {money(record.applied)}
              {record.unapplied > 0 ? <span className="text-success"> / {money(record.unapplied)} held</span> : null}
            </span>
          ),
      },
      {
        id: "state",
        label: "",
        sort: false,
        width: 90,
        render: ({ record }) =>
          record.voided ? (
            <Chip icon={<Chip.Dot />} style={{ "--chip-color": "var(--color-fg-tertiary)" } as CSSProperties}>
              Voided
            </Chip>
          ) : null,
      },
    ],
    [],
  );
  const [sort, setSort] = useState<Sort>({ field: "received", direction: "desc" });
  const table = useTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    fillColumn: "customerName",
    enableSorting: true,
    enablePagination: false,
    sort,
    onSortChange: setSort,
    defaultSortField: "received",
    getRowClassName: (r) => (r.voided ? "text-fg-muted" : undefined),
  });

  const RangeChip = ({ value, children }: { value: Params["range"]; children: ReactNode }) => (
    <Button variant={params.range === value ? "primary" : "secondary"} size="sm" onClick={() => set({ range: value })}>
      {children}
    </Button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <div className="flex flex-wrap items-end justify-between gap-region">
        <div className="flex items-end gap-field-group">
          <div className="flex gap-tight">
            <RangeChip value="today">Today</RangeChip>
            <RangeChip value="mtd">MTD</RangeChip>
            <RangeChip value="custom">Custom</RangeChip>
          </div>
          {params.range === "custom" ? (
            <div className="flex items-center gap-action">
              <DateInput density="compact" value={params.from} max={params.to} onChange={(v) => set({ from: v })} className="w-40" />
              <span className="text-fg-tertiary">to</span>
              <DateInput density="compact" value={params.to} min={params.from} max={params.asOf} onChange={(v) => set({ to: v })} className="w-40" />
            </div>
          ) : null}
        </div>
        <p className="text-body-sm text-fg-secondary">
          {rows.filter((r) => !r.voided).length} payments · <b className="tabular-nums text-fg">{money(total)}</b> received {params.range === "today" ? "today" : params.range === "mtd" ? "month to date" : "in range"}
          {params.asOf !== TODAY ? ` (as of ${fmtDate(params.asOf)})` : ""}
        </p>
      </div>
      <Table sticky className="min-h-0 flex-1" table={table} emptyMessage="No payments in this range">
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant A — Tabs. KPI strip + aging strip above; Balances / Payments tabs.
// The §11 spec.
// ---------------------------------------------------------------------------

function VariantA({ p, params, set }: { p: Projection; params: Params; set: ReturnType<typeof useParams>[1] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!searchParams.get("tab")) set({ tab: "balances" });
  }, [searchParams, set]);
  const tabHref = (tab: Params["tab"]) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    return `${pathname}?${next.toString()}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <Header asOf={params.asOf} onAsOf={(v) => set({ asOf: v })} />
      <KpiStrip p={p} />
      <section className="flex flex-col gap-field">
        <div className="flex items-baseline justify-between">
          <h2 className="section-content-label">Aging · all customers</h2>
          {params.bucket ? (
            <button type="button" className="text-body-sm text-link" onClick={() => set({ bucket: null })}>
              Clear bucket filter
            </button>
          ) : null}
        </div>
        <AgingStrip p={p} active={params.bucket} onPick={(b) => set({ bucket: b })} />
      </section>
      <RouterTabs className="flex min-h-0 flex-1 flex-col" data-testid="accounting-tabs">
        <RouterTabs.List>
          <RouterTabs.Trigger href={tabHref("balances")}>Balances</RouterTabs.Trigger>
          <RouterTabs.Trigger href={tabHref("payments")}>Payments</RouterTabs.Trigger>
        </RouterTabs.List>
        <RouterTabs.Panel className="flex min-h-0 flex-1 flex-col p-0 pt-card">
          {params.tab === "payments" ? <PaymentsTable p={p} params={params} set={set} /> : <BalancesTable rows={p.customerRows} bucket={params.bucket} q={params.q} onQ={(v) => set({ q: v })} />}
        </RouterTabs.Panel>
      </RouterTabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant B — One scroll. Open-AR hero with an aging bar on the left, a sticky
// "Cash in" rail on the right; the balances table is the page. No tabs.
// ---------------------------------------------------------------------------

function VariantB({ p, params, set }: { p: Projection; params: Params; set: ReturnType<typeof useParams>[1] }) {
  const todayRows = p.paymentRows.filter((r) => r.received === params.asOf && !r.voided);
  const mtdRows = p.paymentRows.filter((r) => r.received >= monthStart(params.asOf) && r.received <= params.asOf && !r.voided);
  const recent = p.paymentRows.slice(0, 8);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <Header asOf={params.asOf} onAsOf={(v) => set({ asOf: v })} />
      <div className="grid gap-region lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col gap-form-section">
          <section className="rounded-section border border-border p-card">
            <div className="flex flex-wrap items-end justify-between gap-region">
              <div>
                <div className="section-content-label">Total open AR</div>
                <div className="text-display tabular-nums">{money(p.openAr)}</div>
              </div>
              <div className="flex gap-region text-right">
                <div>
                  <div className="section-content-label">Past due</div>
                  <div className={`text-title-lg tabular-nums ${p.pastDue > 0 ? "text-error" : ""}`}>{money(p.pastDue)}</div>
                  <div className="text-caption text-fg-tertiary">{pct(p.pastDue, p.openAr)} of open</div>
                </div>
                <div>
                  <div className="section-content-label">Customers</div>
                  <div className="text-title-lg tabular-nums">{p.customerRows.filter((r) => r.openBalance > 0).length}</div>
                  <div className="text-caption text-fg-tertiary">with a balance</div>
                </div>
              </div>
            </div>
            <div className="mt-card">
              <AgingBar p={p} active={params.bucket} onPick={(b) => set({ bucket: b })} />
            </div>
          </section>
          <BalancesTable rows={p.customerRows} bucket={params.bucket} q={params.q} onQ={(v) => set({ q: v })} />
        </div>

        <aside className="flex flex-col gap-form-section lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-section border border-border p-card">
            <div className="section-content-label">Cash in</div>
            <dl className="mt-tight grid grid-cols-[1fr_auto] gap-x-region gap-y-tight text-body-sm">
              <dt className="text-fg-tertiary">{params.asOf === TODAY ? "Today" : fmtDate(params.asOf)}</dt>
              <dd className="text-right font-semibold tabular-nums">{money(todayRows.reduce((n, r) => n + r.amount, 0))}</dd>
              <dt className="text-fg-tertiary">Month to date</dt>
              <dd className="text-right font-semibold tabular-nums">{money(mtdRows.reduce((n, r) => n + r.amount, 0))}</dd>
              <dt className="text-fg-tertiary">Unapplied credit</dt>
              <dd className="text-right tabular-nums text-success">{money(p.unappliedTotal)}</dd>
              <dt className="text-fg-tertiary">MTD write-offs</dt>
              <dd className="text-right tabular-nums">{money(p.mtdWriteOffs)}</dd>
            </dl>
          </section>
          <section className="rounded-section border border-border">
            <div className="flex items-baseline justify-between px-section-content-x py-section-content-y">
              <div className="section-content-label">Recent payments</div>
              <span className="text-caption text-fg-tertiary">last {recent.length}</span>
            </div>
            <ul className="divide-y divide-border-subtle">
              {recent.map((r) => (
                <li key={r.id} className={`flex items-center justify-between gap-region px-section-content-x py-item-y text-body-sm ${r.voided ? "text-fg-muted" : ""}`}>
                  <div className="min-w-0">
                    <Link href={customerTabHref(r.customerId)} className="text-link hover:text-link-hover block truncate font-medium">
                      {r.customerName}
                    </Link>
                    <div className="text-caption text-fg-tertiary">
                      {fmtDate(r.received)} · {r.method}
                      {r.reference ? ` ${r.reference}` : ""}
                      {r.voided ? " · voided" : r.unapplied > 0 ? ` · ${money(r.unapplied)} held` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 tabular-nums font-semibold ${r.voided ? "line-through" : ""}`}>{money(r.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const VARIANTS = [
  { key: "A", name: "Tabs — KPI strip, aging strip, Balances / Payments" },
  { key: "B", name: "One scroll — open-AR hero, aging bar, cash-in rail" },
] as const;

export function AccountingPagePrototype() {
  const variant = usePrototypeVariant(VARIANTS);
  const [params, set] = useParams();
  const p = useMemo(() => project(params.asOf), [params.asOf]);

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col">
      {variant === "A" ? <VariantA p={p} params={params} set={set} /> : null}
      {variant === "B" ? <VariantB p={p} params={params} set={set} /> : null}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </div>
  );
}
