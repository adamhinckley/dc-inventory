"use client";

import {
  listInternalAccountingPaymentsTable,
  useListInternalAccountingPayments,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  DateInput,
  formatMoneyMinorUnits,
} from "@dc-inventory/ui";
import { DataTable, type ListQueryHook, type ListQueryParams } from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import {
  accountingAppliedUnappliedLabel,
  accountingPaymentMethodLabel,
} from "../lib/accounting-display";
import type { AccountingPaymentRow } from "../lib/accounting-types";
import {
  accountingPaymentDateRange,
  replaceAccountingSharedParams,
  replaceAccountingTableUrlParams,
  type AccountingPaymentRange,
} from "../lib/accounting-url-params";
import { formatNullableDate } from "../lib/customer-accounting-format";
import { customerDetailTabHref } from "../lib/customer-detail-tabs";

type PaymentsListParams = NonNullable<
  Parameters<typeof useListInternalAccountingPayments>[0]
>;

function PaymentsRangeToolbar({
  asOf,
  initialRange,
  initialFrom,
  initialTo,
}: {
  asOf: string;
  initialRange: AccountingPaymentRange;
  initialFrom: string;
  initialTo: string;
}) {
  const [range, setRange] = useState(initialRange);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const setRangeMode = (next: AccountingPaymentRange) => {
    setRange(next);
    if (next === "custom") {
      replaceAccountingSharedParams({ range: "custom" });
      replaceAccountingTableUrlParams(listInternalAccountingPaymentsTable, {
        from,
        to,
      });
      return;
    }
    replaceAccountingSharedParams({ range: next === "mtd" ? null : next });
    const computed = accountingPaymentDateRange(asOf, next, { from, to });
    setFrom(computed.from);
    setTo(computed.to);
    replaceAccountingTableUrlParams(listInternalAccountingPaymentsTable, computed);
  };

  return (
    <div
      className="flex flex-wrap items-end gap-field-group"
      data-testid="accounting-payments-range"
    >
      <div className="flex gap-tight">
        {(
          [
            ["today", "Today"],
            ["mtd", "MTD"],
            ["custom", "Custom"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={range === value ? "primary" : "secondary"}
            size="sm"
            onClick={() => setRangeMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {range === "custom" ? (
        <div className="flex items-center gap-action">
          <DateInput
            density="compact"
            value={from}
            max={to}
            className="w-40 shrink-0"
            onChange={(value) => {
              setFrom(value);
              replaceAccountingTableUrlParams(listInternalAccountingPaymentsTable, {
                from: value,
                to,
              });
            }}
          />
          <span className="text-fg-tertiary">to</span>
          <DateInput
            density="compact"
            value={to}
            min={from}
            max={asOf}
            className="w-40 shrink-0"
            onChange={(value) => {
              setTo(value);
              replaceAccountingTableUrlParams(listInternalAccountingPaymentsTable, {
                from,
                to: value,
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AccountingPaymentsTable({
  initialParams,
  asOf,
  initialRange,
  initialFrom,
  initialTo,
}: {
  initialParams?: ListQueryParams;
  asOf: string;
  initialRange: AccountingPaymentRange;
  initialFrom: string;
  initialTo: string;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceAccountingTableUrlParams(listInternalAccountingPaymentsTable, params);
  }, []);

  const getRowHref = useCallback(
    (row: AccountingPaymentRow) =>
      customerDetailTabHref(row.customerId, "accounting"),
    [],
  );

  const renderRowLink = useCallback(
    ({ href, children }: { href: string; children: ReactNode }) => (
      <Link href={href} className="text-link hover:text-link-hover">
        {children}
      </Link>
    ),
    [],
  );

  return (
    <DataTable.Root<PaymentsListParams, AccountingPaymentRow>
      meta={listInternalAccountingPaymentsTable}
      queryHook={
        useListInternalAccountingPayments as ListQueryHook<
          PaymentsListParams,
          AccountingPaymentRow
        >
      }
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="customerName"
      renderRowLink={renderRowLink}
      emptyMessage="No payments in this range."
      renderColumns={{
        receivedAt: (row) => formatNullableDate(row.receivedAt),
        customerName: (row) => (
          <span className="min-w-0 truncate font-medium">{row.customerName}</span>
        ),
        amountCents: (row) => (
          <span
            className={`font-semibold tabular-nums ${
              row.voided ? "text-fg-muted line-through" : ""
            }`}
          >
            {formatMoneyMinorUnits(row.amountCents, row.currency)}
          </span>
        ),
        method: (row) => accountingPaymentMethodLabel(row.method),
        reference: (row) => row.reference ?? "—",
        appliedCents: (row) => (
          <span className="tabular-nums">
            {accountingAppliedUnappliedLabel({
              appliedCents: row.appliedCents,
              unappliedCents: row.unappliedCents,
              currency: row.currency,
              voided: row.voided,
            })}
          </span>
        ),
        unappliedCents: () => null,
        voided: (row) =>
          row.voided ? (
            <Chip
              icon={<Chip.Dot />}
              style={
                { "--chip-color": "var(--color-fg-tertiary)" } as CSSProperties
              }
            >
              Voided
            </Chip>
          ) : null,
      }}
      idPrefix="accounting-payments"
    >
      <DataTable.Toolbar>
        <PaymentsRangeToolbar
          asOf={asOf}
          initialRange={initialRange}
          initialFrom={initialFrom}
          initialTo={initialTo}
        />
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
