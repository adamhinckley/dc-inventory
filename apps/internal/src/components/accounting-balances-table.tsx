"use client";

import {
  listInternalAccountingCustomerBalancesTable,
  useListInternalAccountingCustomerBalances,
} from "@dc-inventory/api-client-internal";
import { Chip, formatMoneyMinorUnits } from "@dc-inventory/ui";
import { DataTable, type ListQueryHook, type ListQueryParams } from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { accountingCreditLimitLabel } from "../lib/accounting-display";
import { accountingBalancesListTable } from "../lib/accounting-list-table";
import type { AccountingBalanceRow } from "../lib/accounting-types";
import { useAccountingUrl } from "../lib/use-accounting-url";
import { formatNullableDate } from "../lib/customer-accounting-format";
import { customerDetailTabHref } from "../lib/customer-detail-tabs";

type BalancesListParams = NonNullable<
  Parameters<typeof useListInternalAccountingCustomerBalances>[0]
>;

const CURRENCY = "USD";

export function AccountingBalancesTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const { setTableParams } = useAccountingUrl();
  const searchParams = useSearchParams();
  const remountKey = useMemo(
    () =>
      `${searchParams.get("asOf") ?? ""}:${searchParams.get("bucket") ?? ""}`,
    [searchParams],
  );

  const onParamsChange = useCallback(
    (params: ListQueryParams) => {
      setTableParams(listInternalAccountingCustomerBalancesTable, params);
    },
    [setTableParams],
  );

  const getRowHref = useCallback(
    (row: AccountingBalanceRow) =>
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
    <DataTable.Root<BalancesListParams, AccountingBalanceRow>
      key={remountKey}
      meta={accountingBalancesListTable}
      queryHook={
        useListInternalAccountingCustomerBalances as ListQueryHook<
          BalancesListParams,
          AccountingBalanceRow
        >
      }
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="name"
      renderRowLink={renderRowLink}
      emptyMessage="No customers with a balance."
      renderColumns={{
        name: (row) => (
          <span className="min-w-0 truncate">
            <span className="font-medium">{row.name}</span>
            <span className="text-fg-tertiary"> · {row.customerNumber}</span>
          </span>
        ),
        openBalanceCents: (row) => (
          <span className="font-semibold tabular-nums">
            {formatMoneyMinorUnits(row.openBalanceCents, CURRENCY)}
          </span>
        ),
        pastDueCents: (row) => (
          <span
            className={`tabular-nums ${
              row.pastDueCents > 0 ? "text-error" : "text-fg-muted"
            }`}
          >
            {row.pastDueCents > 0
              ? formatMoneyMinorUnits(row.pastDueCents, CURRENCY)
              : "—"}
          </span>
        ),
        oldestDueDate: (row) => formatNullableDate(row.oldestDueDate),
        daysPastDue: (row) => (
          <span
            className={`tabular-nums ${
              row.daysPastDue > 30 ? "text-error" : ""
            }`}
          >
            {row.daysPastDue > 0 ? row.daysPastDue : "—"}
          </span>
        ),
        creditLimitCents: (row) => (
          <span className="tabular-nums">
            {accountingCreditLimitLabel(row.creditLimitCents, CURRENCY)}
          </span>
        ),
        availableCreditCents: (row) => (
          <span
            className={`tabular-nums ${
              row.availableCreditCents < 0 ? "font-medium text-error" : ""
            }`}
          >
            {formatMoneyMinorUnits(row.availableCreditCents, CURRENCY)}
          </span>
        ),
        hasActivePlan: (row) =>
          row.hasActivePlan ? (
            <Chip
              icon={<Chip.Dot />}
              style={{ "--chip-color": "var(--color-info)" } as CSSProperties}
            >
              Plan
            </Chip>
          ) : (
            "—"
          ),
      }}
      idPrefix="accounting-balances"
    >
      <DataTable.Toolbar>
        <DataTable.Search />
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
