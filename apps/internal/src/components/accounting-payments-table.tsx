"use client";

import {
  listInternalAccountingPaymentsTable,
  useListInternalAccountingPayments,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  DateRangeInput,
  formatMoneyMinorUnits,
} from "@dc-inventory/ui";
import { CalendarRange } from "lucide-react";
import { DataTable, type ListQueryHook, type ListQueryParams } from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  accountingAppliedUnappliedLabel,
  accountingPaymentMethodLabel,
} from "../lib/accounting-display";
import { accountingPaymentsListTable } from "../lib/accounting-list-table";
import type { AccountingPaymentRow } from "../lib/accounting-types";
import {
  accountingAsOfFromSearchParams,
  accountingPaymentDateRange,
  accountingPaymentRangeFromSearchParams,
  type AccountingPaymentRange,
} from "../lib/accounting-url-params";
import { useAccountingUrl } from "../lib/use-accounting-url";
import { formatNullableDate } from "../lib/customer-accounting-format";
import { customerDetailTabHref } from "../lib/customer-detail-tabs";
import { searchParamsToRecord } from "../lib/table-url-params";

type PaymentsListParams = NonNullable<
  Parameters<typeof useListInternalAccountingPayments>[0]
>;

function PaymentsRangeToolbar({
  asOf,
  range,
  from,
  to,
}: {
  asOf: string;
  range: AccountingPaymentRange;
  from: string;
  to: string;
}) {
  const { setSharedParams } = useAccountingUrl();

  const setRangeMode = (next: AccountingPaymentRange) => {
    if (next === "custom") {
      setSharedParams({
        range: "custom",
        from,
        to,
      });
      return;
    }
    setSharedParams({
      range: next === "mtd" ? null : next,
      from: null,
      to: null,
    });
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
            <CalendarRange className="size-icon-sm" aria-hidden />
            {label}
          </Button>
        ))}
      </div>
      {range === "custom" ? (
        <DateRangeInput
          density="compact"
          showHint={false}
          showPresets={false}
          className="w-64 shrink-0"
          value={{ from, to }}
          max={asOf}
          onChange={(next) => {
            setSharedParams({
              range: "custom",
              from: next.from ?? from,
              to: next.to ?? to,
            });
          }}
        />
      ) : null}
    </div>
  );
}

export function AccountingPaymentsTable({
  initialParams,
  asOf,
}: {
  initialParams?: ListQueryParams;
  asOf: string;
}) {
  const { setTableParams } = useAccountingUrl();
  const searchParams = useSearchParams();
  const searchRecord = useMemo(
    () => searchParamsToRecord(searchParams),
    [searchParams],
  );
  const range = accountingPaymentRangeFromSearchParams(searchRecord);
  const { from, to } = accountingPaymentDateRange(asOf, range, searchRecord);
  const remountKey = useMemo(
    () =>
      `${searchParams.get("asOf") ?? ""}:${searchParams.get("range") ?? "mtd"}:${searchParams.get("from") ?? ""}:${searchParams.get("to") ?? ""}`,
    [searchParams],
  );

  const onParamsChange = useCallback(
    (params: ListQueryParams) => {
      setTableParams(listInternalAccountingPaymentsTable, params);
    },
    [setTableParams],
  );

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
      key={remountKey}
      meta={accountingPaymentsListTable}
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
        <PaymentsRangeToolbar asOf={asOf} range={range} from={from} to={to} />
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
