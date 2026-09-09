"use client";

import {
  useGetInternalCustomerAccounting,
  useListInternalCustomerInvoices,
  useListInternalCustomerPayments,
  useListInternalSalesOrders,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Checkbox,
  Chip,
  DescriptionList,
  formatMoneyMinorUnits,
} from "@dc-inventory/ui";
import { ArrowLeftRight, Ban, FileMinus, HandCoins, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import type { AllocationInvoice } from "../lib/customer-accounting-allocation";
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABELS,
  formatNullableDate,
  formatNullableMoney,
  formatPercent,
  sumPastDueCents,
} from "../lib/customer-accounting-format";
import { customerInvoiceStatusPresentation } from "../lib/customer-invoice-status-chip";
import type {
  CustomerAccountingSummary,
  CustomerInvoiceRow,
  CustomerPaymentRow,
} from "../lib/customer-accounting-types";
import { useStaffAccountingActions } from "../lib/staff-accounting-actions";
import {
  CustomerAccountingAdjustDialog,
  CustomerAccountingApplyCreditPickerDialog,
  CustomerAccountingEndPlanButton,
  CustomerAccountingPlanDialog,
  CustomerAccountingReallocateDialog,
  CustomerAccountingVoidDialog,
} from "./customer-accounting-dialogs";
import { CustomerAccountingRecordPayment } from "./customer-accounting-record-payment";

type DrawerTab = "payments" | "plan" | "stats";

function InvoiceGrid({
  rows,
  currency,
  orderNumbers,
  canArAdjust,
  onAdjust,
}: {
  rows: CustomerInvoiceRow[];
  currency: string;
  orderNumbers: ReadonlyMap<string, string>;
  canArAdjust: boolean;
  onAdjust: (invoice: CustomerInvoiceRow) => void;
}) {
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr className="border-b border-border">
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Invoice
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Date
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Due
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Order
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
            Amount
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
            Remaining
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Terms
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Status
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
            {""}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((invoice) => {
          const status = customerInvoiceStatusPresentation(invoice.status);
          return (
            <tr
              key={invoice.id}
              className="border-b border-border-subtle hover:bg-surface-raised"
            >
              <td className="px-section-content-x py-section-content-y text-body-sm">
                {invoice.documentNumber}
              </td>
              <td className="px-section-content-x py-section-content-y text-body-sm tabular-nums">
                {formatNullableDate(invoice.postedAt)}
              </td>
              <td
                className={`px-section-content-x py-section-content-y text-body-sm tabular-nums ${
                  invoice.status === "past_due" ? "text-error" : ""
                }`}
              >
                {formatNullableDate(invoice.dueDate)}
              </td>
              <td className="px-section-content-x py-section-content-y text-body-sm">
                <Link
                  href={`/sales/${invoice.orderId}`}
                  className="text-link hover:text-link-hover tabular-nums"
                >
                  {orderNumbers.get(invoice.orderId) ?? invoice.orderId}
                </Link>
              </td>
              <td className="px-section-content-x py-section-content-y text-right text-body-sm tabular-nums">
                {formatMoneyMinorUnits(invoice.totalCents, invoice.currency)}
              </td>
              <td className="px-section-content-x py-section-content-y text-right text-body-sm font-semibold tabular-nums">
                {formatMoneyMinorUnits(invoice.remainingCents, invoice.currency)}
              </td>
              <td className="px-section-content-x py-section-content-y text-body-sm">
                {invoice.terms ?? "—"}
              </td>
              <td className="px-section-content-x py-section-content-y text-body-sm">
                <Chip
                  icon={<Chip.Dot />}
                  style={{ "--chip-color": status.color } as CSSProperties}
                >
                  {status.label}
                </Chip>
              </td>
              <td className="px-section-content-x py-section-content-y text-right">
                {canArAdjust ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAdjust(invoice)}
                  >
                    <FileMinus className="size-icon-sm" aria-hidden />
                    Adjust Invoice
                  </Button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PaymentsTable({
  payments,
  currency,
  invoiceNumbers,
  canApplyPayments,
  canArAdjust,
  onReallocate,
  onVoid,
}: {
  payments: CustomerPaymentRow[];
  currency: string;
  invoiceNumbers: ReadonlyMap<string, string>;
  canApplyPayments: boolean;
  canArAdjust: boolean;
  onReallocate: (payment: CustomerPaymentRow) => void;
  onVoid: (payment: CustomerPaymentRow) => void;
}) {
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Received
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
            Amount
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Method
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
            Applied to
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
            Unapplied
          </th>
          <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
            {""}
          </th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => {
          const appliedSummary =
            payment.applications.length === 0
              ? "—"
              : payment.applications
                  .map((application) => {
                    const label =
                      invoiceNumbers.get(application.invoiceId) ??
                      application.invoiceId;
                    return `${label} ${formatMoneyMinorUnits(application.amountCents, application.currency)}`;
                  })
                  .join(", ");
          return (
            <tr
              key={payment.id}
              className={payment.voided ? "text-fg-muted line-through" : ""}
            >
              <td className="px-section-content-x py-section-content-y text-body-sm tabular-nums">
                {formatNullableDate(payment.receivedAt)}
              </td>
              <td className="px-section-content-x py-section-content-y text-right text-body-sm tabular-nums">
                {formatMoneyMinorUnits(payment.amountCents, payment.currency)}
              </td>
              <td className="px-section-content-x py-section-content-y text-body-sm">
                {payment.method}
                {payment.reference ? ` ${payment.reference}` : ""}
              </td>
              <td className="px-section-content-x py-section-content-y text-body-sm">
                {payment.voided ? "void" : appliedSummary}
              </td>
              <td className="px-section-content-x py-section-content-y text-right text-body-sm tabular-nums">
                {payment.unappliedCents > 0
                  ? formatMoneyMinorUnits(payment.unappliedCents, payment.currency)
                  : "—"}
              </td>
              <td className="px-section-content-x py-section-content-y text-right">
                {payment.voided || (!canApplyPayments && !canArAdjust) ? null : (
                  <span className="flex justify-end gap-action">
                    {canApplyPayments ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onReallocate(payment)}
                      >
                        <ArrowLeftRight className="size-icon-sm" aria-hidden />
                        Reallocate
                      </Button>
                    ) : null}
                    {canArAdjust ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onVoid(payment)}
                      >
                        <Ban className="size-icon-sm" aria-hidden />
                        Void
                      </Button>
                    ) : null}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StatsBlock({
  summary,
  currency,
}: {
  summary: CustomerAccountingSummary;
  currency: string;
}) {
  const rows = summary.stats;
  const left: Array<[string, string]> = [
    ["Highest invoice", formatNullableMoney(rows.highestInvoiceCents, currency)],
    ["Avg invoice", formatNullableMoney(rows.avgInvoiceCents, currency)],
    ["Open invoice count", String(rows.openInvoiceCount)],
    ["Total invoice amount", formatNullableMoney(rows.totalOpenInvoiceAmountCents, currency)],
    ["Credit memo count", String(rows.creditMemoCount)],
    ["Total CM", formatNullableMoney(rows.totalCreditMemoCents, currency)],
    ["Total write-offs", formatNullableMoney(rows.totalWriteOffsCents, currency)],
    ["Open balance", formatNullableMoney(rows.openBalanceCents, currency)],
    ["Credit limit", formatNullableMoney(rows.creditLimitCents, currency)],
    ["Available credit", formatNullableMoney(rows.availableCreditCents, currency)],
    ["Unapplied credit", formatNullableMoney(rows.unappliedCreditCents, currency)],
  ];
  const right: Array<[string, string]> = [
    ["Date of first shipment", formatNullableDate(rows.dateOfFirstShipment)],
    ["Date of last shipment", formatNullableDate(rows.dateOfLastShipment)],
    ["Date of last order", formatNullableDate(rows.dateOfLastOrder)],
    ["Avg days to pay", rows.avgDaysToPay?.toString() ?? "—"],
    ["Last YTD sales", formatNullableMoney(rows.lastYtdSalesCents, currency)],
    ["YTD sales", formatNullableMoney(rows.ytdSalesCents, currency)],
    ["LYTD vs YTD", formatPercent(rows.lytdVsYtdPercent)],
    ["Last year's sales", formatNullableMoney(rows.lastYearSalesCents, currency)],
    ["Total sales", formatNullableMoney(rows.totalSalesCents, currency)],
  ];

  return (
    <div className="grid gap-form-section md:grid-cols-2">
      <DescriptionList>
        {left.map(([term, value]) => (
          <DescriptionList.Item key={term}>
            <DescriptionList.Term>{term}</DescriptionList.Term>
            <DescriptionList.Data>
              <span className="tabular-nums">{value}</span>
            </DescriptionList.Data>
          </DescriptionList.Item>
        ))}
      </DescriptionList>
      <DescriptionList>
        {right.map(([term, value]) => (
          <DescriptionList.Item key={term}>
            <DescriptionList.Term>{term}</DescriptionList.Term>
            <DescriptionList.Data>
              <span className="tabular-nums">{value}</span>
            </DescriptionList.Data>
          </DescriptionList.Item>
        ))}
      </DescriptionList>
    </div>
  );
}

export function CustomerAccountingPanel({ customerId }: { customerId: string }) {
  const { canApplyPayments, canArAdjust, canManagePaymentPlans } =
    useStaffAccountingActions();
  const [showPaid, setShowPaid] = useState(false);
  const [drawer, setDrawer] = useState<DrawerTab>("payments");
  const [adjustInvoice, setAdjustInvoice] = useState<CustomerInvoiceRow | null>(null);
  const [reallocatePayment, setReallocatePayment] =
    useState<CustomerPaymentRow | null>(null);
  const [voidPayment, setVoidPayment] = useState<CustomerPaymentRow | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [applyCreditOpen, setApplyCreditOpen] = useState(false);
  const [applyCreditPickerOpen, setApplyCreditPickerOpen] = useState(false);

  const summaryQuery = useGetInternalCustomerAccounting(customerId);
  const salesOrdersQuery = useListInternalSalesOrders({
    customerId,
    page: 1,
    pageSize: 100,
    sortBy: "documentNumber",
    sortOrder: "desc",
  });
  const invoicesQuery = useListInternalCustomerInvoices(customerId, {
    includePaid: showPaid,
  });
  const paymentsQuery = useListInternalCustomerPayments(customerId);

  const summary =
    summaryQuery.data?.status === 200 ? summaryQuery.data.data : undefined;
  const invoices =
    invoicesQuery.data?.status === 200 ? invoicesQuery.data.data.items : [];
  const payments =
    paymentsQuery.data?.status === 200 ? paymentsQuery.data.data.items : [];

  const currency = invoices[0]?.currency ?? "USD";
  const openInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.remainingCents > 0),
    [invoices],
  );
  const allocationInvoices: AllocationInvoice[] = useMemo(
    () =>
      openInvoices.map((invoice) => ({
        id: invoice.id,
        documentNumber: invoice.documentNumber,
        remainingCents: invoice.remainingCents,
        dueDate: invoice.dueDate,
        postedAt: invoice.postedAt,
      })),
    [openInvoices],
  );
  const creditPayments = useMemo(
    () => payments.filter((payment) => !payment.voided && payment.unappliedCents > 0),
    [payments],
  );
  const pastDueCents = summary ? sumPastDueCents(summary.aging) : 0;
  const invoiceNumbers = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice.documentNumber])),
    [invoices],
  );
  const orderNumbers = useMemo(() => {
    const items =
      salesOrdersQuery.data?.status === 200
        ? salesOrdersQuery.data.data.items
        : [];
    return new Map(items.map((order) => [order.id, order.documentNumber]));
  }, [salesOrdersQuery.data]);

  const loading =
    summaryQuery.isLoading || invoicesQuery.isLoading || paymentsQuery.isLoading;
  const error =
    summaryQuery.isError || invoicesQuery.isError || paymentsQuery.isError;

  if (loading) {
    return <p className="text-body-sm text-fg-secondary">Loading accounting…</p>;
  }

  if (error || !summary) {
    return (
      <p className="text-body-sm text-error">
        Could not load accounting for this customer.
      </p>
    );
  }

  return (
    <section
      className="grid gap-form-section lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]"
      data-testid="customer-accounting-panel"
    >
      <div className="flex min-w-0 flex-col gap-form-section">
        <div className="flex flex-wrap items-baseline gap-region">
          <span className="text-title-sm">Open balance</span>
          <span className="section-content-stat-value">
            {formatMoneyMinorUnits(summary.openBalanceCents, currency)}
          </span>
          <span className="text-body-sm text-fg-secondary">
            {formatMoneyMinorUnits(summary.openBalanceOwedCents, currency)} owed
            {summary.unappliedCreditCents > 0
              ? ` − ${formatMoneyMinorUnits(summary.unappliedCreditCents, currency)} credit`
              : ""}
          </span>
          {pastDueCents > 0 ? (
            <span className="text-body-sm text-error">
              {formatMoneyMinorUnits(pastDueCents, currency)} past due
            </span>
          ) : null}
          {summary.unappliedCreditCents > 0 ? (
            <span className="text-body-sm text-success">
              {formatMoneyMinorUnits(summary.unappliedCreditCents, currency)} credit on account
            </span>
          ) : null}
          <span className="ml-auto flex flex-wrap items-center gap-action">
            {canApplyPayments &&
            summary.unappliedCreditCents > 0 &&
            creditPayments.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (creditPayments.length === 1) {
                    const payment = creditPayments[0];
                    if (payment) {
                      setReallocatePayment(payment);
                      setApplyCreditOpen(true);
                    }
                    return;
                  }
                  setApplyCreditPickerOpen(true);
                }}
              >
                <HandCoins className="size-icon" aria-hidden />
                Apply Credit
              </Button>
            ) : null}
            <label className="flex items-center gap-icon text-body-sm text-fg-secondary">
              <Checkbox checked={showPaid} onChange={setShowPaid} />
              Show Paid
            </label>
          </span>
        </div>

        <div className="grid grid-cols-7 gap-tight">
          {AGING_BUCKET_KEYS.map((key, index) => {
            const amount = summary.aging[key];
            return (
              <div
                key={key}
                className={`rounded-interactable border px-item-x py-item-y ${
                  index > 0 && amount > 0 ? "border-error" : "border-border"
                }`}
              >
                <div className="text-caption text-fg-tertiary">
                  {AGING_BUCKET_LABELS[key]}
                </div>
                <div className="text-body-sm tabular-nums">
                  {formatMoneyMinorUnits(amount, currency)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-section border border-border">
          <InvoiceGrid
            rows={invoices}
            currency={currency}
            orderNumbers={orderNumbers}
            canArAdjust={canArAdjust}
            onAdjust={setAdjustInvoice}
          />
        </div>

        <div>
          <div className="flex gap-tight border-b border-border">
            {(
              [
                ["payments", "Payments"],
                ["plan", "Payment plan"],
                ["stats", "Stats"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDrawer(key)}
                className={`tab-trigger px-item-x py-item-y text-body-sm ${
                  drawer === key
                    ? "border-b-2 border-accent-indicator font-semibold"
                    : "text-fg-tertiary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pt-field">
            {drawer === "payments" ? (
              <PaymentsTable
                payments={payments}
                currency={currency}
                invoiceNumbers={invoiceNumbers}
                canApplyPayments={canApplyPayments}
                canArAdjust={canArAdjust}
                onReallocate={(payment) => {
                  setReallocatePayment(payment);
                  setApplyCreditOpen(false);
                }}
                onVoid={setVoidPayment}
              />
            ) : null}
            {drawer === "plan" ? (
              <div className="rounded-section border border-border p-card">
                {summary.plan ? (
                  <div className="flex flex-col gap-field sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="section-content-label">Payment plan</div>
                      <div className="text-body-emphasis">
                        {formatMoneyMinorUnits(
                          summary.plan.installmentAmountCents,
                          summary.plan.currency,
                        )}{" "}
                        {summary.plan.frequency} · from {summary.plan.startsOn}
                      </div>
                      {summary.planExpectations ? (
                        <div className="text-body-sm text-fg-secondary">
                          Received {summary.planExpectations.installmentsReceived} of{" "}
                          {summary.planExpectations.installmentsExpectedSoFar} expected
                          {summary.planExpectations.nextExpectedOn
                            ? ` · next ${summary.planExpectations.nextExpectedOn}`
                            : ""}
                          {summary.planExpectations.estimatedEndOn
                            ? ` · est. end ${summary.planExpectations.estimatedEndOn}`
                            : ""}
                        </div>
                      ) : null}
                      {summary.planExpectations &&
                      summary.planExpectations.missedInstallments > 0 ? (
                        <div className="text-body-sm text-error">
                          {summary.planExpectations.missedInstallments} installment
                          {summary.planExpectations.missedInstallments === 1 ? "" : "s"} missed
                          (shown only — nothing is blocked)
                        </div>
                      ) : null}
                    </div>
                    {canManagePaymentPlans ? (
                      <CustomerAccountingEndPlanButton customerId={customerId} />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-field sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-body-sm text-fg-secondary">
                      No active payment plan for this customer.
                    </p>
                    {canManagePaymentPlans ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setPlanOpen(true)}
                      >
                        <Plus className="size-icon" aria-hidden />
                        New Plan
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
            {drawer === "stats" ? (
              <StatsBlock summary={summary} currency={currency} />
            ) : null}
          </div>
        </div>
      </div>

      <CustomerAccountingRecordPayment
        customerId={customerId}
        openInvoices={allocationInvoices}
        currency={currency}
        canApplyPayments={canApplyPayments}
      />

      <CustomerAccountingAdjustDialog
        customerId={customerId}
        invoice={adjustInvoice}
        open={adjustInvoice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustInvoice(null);
          }
        }}
      />
      <CustomerAccountingVoidDialog
        customerId={customerId}
        payment={voidPayment}
        open={voidPayment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVoidPayment(null);
          }
        }}
      />
      <CustomerAccountingReallocateDialog
        customerId={customerId}
        payment={reallocatePayment}
        openInvoices={openInvoices}
        open={reallocatePayment !== null && !applyCreditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReallocatePayment(null);
          }
        }}
      />
      <CustomerAccountingReallocateDialog
        customerId={customerId}
        payment={reallocatePayment}
        openInvoices={openInvoices}
        open={reallocatePayment !== null && !applyCreditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReallocatePayment(null);
          }
        }}
      />
      <CustomerAccountingApplyCreditPickerDialog
        payments={creditPayments}
        currency={currency}
        open={applyCreditPickerOpen}
        onOpenChange={setApplyCreditPickerOpen}
        onSelect={(payment) => {
          setReallocatePayment(payment);
          setApplyCreditOpen(true);
        }}
      />
      <CustomerAccountingReallocateDialog
        customerId={customerId}
        payment={reallocatePayment}
        openInvoices={openInvoices}
        open={applyCreditOpen}
        onOpenChange={(open) => {
          setApplyCreditOpen(open);
          if (!open) {
            setReallocatePayment(null);
          }
        }}
        title="Apply Credit"
      />
      {canManagePaymentPlans ? (
        <CustomerAccountingPlanDialog
          customerId={customerId}
          currency={currency}
          open={planOpen}
          onOpenChange={setPlanOpen}
        />
      ) : null}
    </section>
  );
}
