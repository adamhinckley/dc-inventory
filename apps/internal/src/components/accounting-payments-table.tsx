"use client";

import {
  getListInternalCustomerInvoicesQueryKey,
  getListInternalCustomerInvoicesQueryOptions,
  listInternalAccountingPaymentsTable,
  useListInternalAccountingPayments,
  useListInternalCustomerInvoices,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Chip,
  DateRangeInput,
  formatMoneyMinorUnits,
} from "@dc-inventory/ui";
import { CalendarRange } from "lucide-react";
import { DataTable, type ListQueryHook, type ListQueryParams } from "@dc-inventory/ui-internal";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  accountingPaymentsInitialParams,
  type AccountingPaymentRange,
} from "../lib/accounting-url-params";
import { useAccountingUrl } from "../lib/use-accounting-url";
import type { CustomerInvoiceRow, CustomerPaymentRow } from "../lib/customer-accounting-types";
import {
  paymentDetailFromAccountingPayment,
  paymentDetailToCustomerRow,
  type PaymentDetailRecord,
} from "../lib/payment-detail";
import { customerDetailTabHref } from "../lib/customer-detail-tabs";
import { useStaffAccountingActions } from "../lib/staff-accounting-actions";
import {
  CustomerAccountingReallocateDialog,
  CustomerAccountingVoidDialog,
} from "./customer-accounting-dialogs";
import {
  PaymentDetailDialog,
  PaymentReceivedDateButton,
} from "./payment-detail-dialog";

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

export function AccountingPaymentsTable() {
  const queryClient = useQueryClient();
  const { canApplyPayments, canArAdjust } = useStaffAccountingActions();
  const [detail, setDetail] = useState<PaymentDetailRecord | null>(null);
  const [reallocatePayment, setReallocatePayment] = useState<CustomerPaymentRow | null>(
    null,
  );
  const [voidPayment, setVoidPayment] = useState<CustomerPaymentRow | null>(null);
  const [actionCustomerId, setActionCustomerId] = useState("");
  const { searchRecord, setTableParams } = useAccountingUrl();
  const asOf = accountingAsOfFromSearchParams(searchRecord);
  const range = accountingPaymentRangeFromSearchParams(searchRecord);
  const { from, to } = accountingPaymentDateRange(asOf, range, searchRecord);
  const initialParams = useMemo(
    () => accountingPaymentsInitialParams(searchRecord),
    [searchRecord],
  );
  const remountKey = useMemo(
    () => `${asOf}:${range}:${from}:${to}`,
    [asOf, range, from, to],
  );

  const onParamsChange = useCallback(
    (params: ListQueryParams) => {
      setTableParams(listInternalAccountingPaymentsTable, params);
    },
    [setTableParams],
  );

  const invoiceCustomerId = actionCustomerId || detail?.customerId || "";
  const invoicesQuery = useListInternalCustomerInvoices(
    invoiceCustomerId,
    { includePaid: true },
    {
      query: {
        enabled: invoiceCustomerId.length > 0,
        queryKey: getListInternalCustomerInvoicesQueryKey(invoiceCustomerId, {
          includePaid: true,
        }),
      },
    },
  );
  const invoices: CustomerInvoiceRow[] =
    invoicesQuery.data?.status === 200 ? invoicesQuery.data.data.items : [];
  const invoiceNumbers = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice.documentNumber])),
    [invoices],
  );
  const openInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.remainingCents > 0),
    [invoices],
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

  const openPaymentDetail = useCallback(
    async (row: AccountingPaymentRow) => {
      setActionCustomerId(row.customerId);
      await queryClient.prefetchQuery(
        getListInternalCustomerInvoicesQueryOptions(row.customerId, { includePaid: true }),
      );
      setDetail(paymentDetailFromAccountingPayment(row));
    },
    [queryClient],
  );

  return (
    <>
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
        receivedAt: (row) => (
          <PaymentReceivedDateButton
            receivedAt={row.receivedAt}
            onClick={() => void openPaymentDetail(row)}
          />
        ),
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
    <PaymentDetailDialog
      payment={detail}
      invoiceNumbers={invoiceNumbers}
      open={detail !== null}
      onOpenChange={(open) => {
        if (!open) {
          setDetail(null);
        }
      }}
      canApplyPayments={canApplyPayments}
      canArAdjust={canArAdjust}
      onReallocate={(payment) => {
        setActionCustomerId(payment.customerId);
        setReallocatePayment(paymentDetailToCustomerRow(payment));
      }}
      onVoid={(payment) => {
        setActionCustomerId(payment.customerId);
        setVoidPayment(paymentDetailToCustomerRow(payment));
      }}
    />
    <CustomerAccountingReallocateDialog
      customerId={actionCustomerId || detail?.customerId || ""}
      payment={reallocatePayment}
      openInvoices={openInvoices}
      open={reallocatePayment !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReallocatePayment(null);
        }
      }}
      onSuccess={() => setDetail(null)}
    />
    <CustomerAccountingVoidDialog
      customerId={actionCustomerId || detail?.customerId || ""}
      payment={voidPayment}
      open={voidPayment !== null}
      onOpenChange={(open) => {
        if (!open) {
          setVoidPayment(null);
        }
      }}
      onSuccess={() => setDetail(null)}
    />
    </>
  );
}
