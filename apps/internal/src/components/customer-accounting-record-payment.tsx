"use client";

import {
  useRecordInternalCustomerPayment,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Checkbox,
  FieldRow,
  Input,
  Label,
  LabeledField,
  formatMoneyMinorUnits,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  allocationRemainderCents,
  mergeAllocations,
  prefillAllocationsOldestFirst,
  recordPaymentSubmitDisabled,
  sumAllocations,
  type AllocationInvoice,
} from "../lib/customer-accounting-allocation";
import {
  formatCentsInputValue,
  parseDollarsToCents,
  todayIsoDate,
} from "../lib/customer-accounting-format";
import { invalidateCustomerAccountingQueries } from "../lib/customer-accounting-queries";

const PAYMENT_METHOD_OPTIONS = [
  { value: "check", label: "Check" },
  { value: "card", label: "Card" },
  { value: "ach", label: "ACH" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;

function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function CustomerAccountingRecordPayment({
  customerId,
  openInvoices,
  currency,
}: {
  customerId: string;
  openInvoices: AllocationInvoice[];
  currency: string;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync: recordPayment, isPending } = useRecordInternalCustomerPayment();

  const [amountInput, setAmountInput] = useState("");
  const [method, setMethod] = useState<typeof PAYMENT_METHOD_OPTIONS[number]["value"]>("check");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayIsoDate());
  const [holdRemainderAsCredit, setHoldRemainderAsCredit] = useState(false);
  const [applyOverrides, setApplyOverrides] = useState<Record<string, number>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const amountCents = parseDollarsToCents(amountInput);
  const prefill = useMemo(
    () => prefillAllocationsOldestFirst(amountCents, openInvoices),
    [amountCents, openInvoices],
  );
  const allocations = useMemo(
    () => mergeAllocations(prefill, applyOverrides),
    [prefill, applyOverrides],
  );
  const allocatedCents = sumAllocations(allocations);
  const remainderCents = allocationRemainderCents({
    amountCents,
    allocatedCents,
    holdRemainderAsCredit,
  });
  const submitDisabled =
    isPending ||
    recordPaymentSubmitDisabled({
      amountCents,
      allocatedCents,
      holdRemainderAsCredit,
    });

  useEffect(() => {
    if (remainderCents <= 0) {
      setHoldRemainderAsCredit(false);
    }
  }, [remainderCents]);

  const resetAllocations = useCallback(() => {
    setApplyOverrides({});
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    setAmountInput(value);
    setApplyOverrides({});
    setSubmitError(null);
  }, []);

  const handleApplyChange = useCallback((invoiceId: string, value: string) => {
    const cents = parseDollarsToCents(value);
    setApplyOverrides((current) => ({
      ...current,
      [invoiceId]: cents,
    }));
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    const applications = Object.entries(allocations)
      .filter(([, amount]) => amount > 0)
      .map(([invoiceId, amountCentsValue]) => ({
        invoiceId,
        amountCents: amountCentsValue,
      }));

    try {
      const response = await recordPayment({
        id: customerId,
        data: {
          amountCents,
          currency,
          method,
          reference: reference.trim() ? reference.trim() : null,
          note: note.trim() ? note.trim() : null,
          receivedAt: receivedDate,
          idempotencyKey,
          holdRemainderAsCredit,
          applications,
        },
      });
      if (response.status !== 200) {
        setSubmitError("Could not record payment. Check the amounts and try again.");
        return;
      }
      await invalidateCustomerAccountingQueries(queryClient, customerId);
      setAmountInput("");
      setReference("");
      setNote("");
      setReceivedDate(todayIsoDate());
      setHoldRemainderAsCredit(false);
      setApplyOverrides({});
      setIdempotencyKey(createIdempotencyKey());
    } catch {
      setSubmitError("Could not record payment. Check the amounts and try again.");
    }
  }, [
    allocations,
    amountCents,
    currency,
    customerId,
    holdRemainderAsCredit,
    idempotencyKey,
    method,
    note,
    queryClient,
    receivedDate,
    recordPayment,
    reference,
  ]);

  const sortedInvoices = useMemo(
    () =>
      [...openInvoices].sort((left, right) => {
        const leftDue = left.dueDate ?? "";
        const rightDue = right.dueDate ?? "";
        return leftDue < rightDue ? -1 : leftDue > rightDue ? 1 : 0;
      }),
    [openInvoices],
  );

  return (
    <aside className="lg:sticky lg:top-canvas lg:self-start">
      <div
        className="rounded-section border border-accent-indicator bg-surface-card p-card"
        data-testid="customer-accounting-record-payment"
      >
        <h2 className="text-title-sm">Record Payment</h2>
        <div className="mt-field grid grid-cols-1 gap-field-group sm:grid-cols-2">
          <LabeledField>
            <Label htmlFor="record-payment-amount">Amount</Label>
            <Input
              id="record-payment-amount"
              value={amountInput}
              onChange={(event) => handleAmountChange(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </LabeledField>
          <LabeledField>
            <Label htmlFor="record-payment-method">Method</Label>
            <select
              id="record-payment-method"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as typeof PAYMENT_METHOD_OPTIONS[number]["value"])
              }
              className="text-input min-h-(--space-input-height) w-full rounded-interactable border border-border-field bg-surface-base px-input-x"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField>
            <Label htmlFor="record-payment-reference">Reference</Label>
            <Input
              id="record-payment-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Check #"
            />
          </LabeledField>
          <LabeledField>
            <Label htmlFor="record-payment-received">Received</Label>
            <Input
              id="record-payment-received"
              type="date"
              value={receivedDate}
              onChange={(event) => setReceivedDate(event.target.value)}
            />
          </LabeledField>
          <LabeledField className="sm:col-span-2">
            <Label htmlFor="record-payment-note">Note</Label>
            <Input
              id="record-payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </LabeledField>
        </div>

        {sortedInvoices.length > 0 ? (
          <div className="mt-field-group overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="border-b border-border">
                  <th className="section-content-column-header px-section-content-x py-section-content-y text-left">
                    Invoice
                  </th>
                  <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
                    Remaining
                  </th>
                  <th className="section-content-column-header px-section-content-x py-section-content-y text-right">
                    Apply
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border-subtle">
                    <td className="px-section-content-x py-section-content-y text-body-sm">
                      <div>{invoice.documentNumber}</div>
                      {invoice.dueDate ? (
                        <div className="text-caption text-fg-tertiary">
                          due {invoice.dueDate}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-section-content-x py-section-content-y text-right text-body-sm tabular-nums">
                      {formatMoneyMinorUnits(invoice.remainingCents, currency)}
                    </td>
                    <td className="px-section-content-x py-section-content-y text-right">
                      <Input
                        className="ml-auto w-28 text-right"
                        value={formatCentsInputValue(allocations[invoice.id] ?? 0)}
                        onChange={(event) =>
                          handleApplyChange(invoice.id, event.target.value)
                        }
                        inputMode="decimal"
                        aria-label={`Apply to invoice ${invoice.documentNumber}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-field-group text-body-sm text-fg-secondary">
            No open invoices to allocate.
          </p>
        )}

        <div className="mt-field flex items-center justify-between text-body-sm">
          <span className="text-fg-secondary">Remaining to allocate</span>
          <span
            className={`tabular-nums font-semibold ${
              remainderCents < 0
                ? "text-error"
                : remainderCents > 0 && !holdRemainderAsCredit
                  ? "text-warning"
                  : "text-fg"
            }`}
            data-testid="customer-accounting-allocation-remainder"
          >
            {formatMoneyMinorUnits(remainderCents, currency)}
          </span>
        </div>

        {remainderCents > 0 ? (
          <label className="mt-tight flex items-center gap-icon text-body-sm">
            <Checkbox
              checked={holdRemainderAsCredit}
              onChange={setHoldRemainderAsCredit}
            />
            Hold {formatMoneyMinorUnits(remainderCents, currency)} as credit on account
          </label>
        ) : null}

        {remainderCents < 0 ? (
          <p className="mt-tight text-body-sm text-error">
            Applied more than the payment amount.
          </p>
        ) : null}

        {submitError ? (
          <p className="mt-tight text-body-sm text-error">{submitError}</p>
        ) : null}

        <FieldRow className="mt-field-group">
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto"
            disabled={submitDisabled}
            onClick={() => void handleSubmit()}
            data-testid="customer-accounting-record-payment-submit"
          >
            <CircleDollarSign className="size-icon" aria-hidden />
            Record {amountCents > 0 ? formatMoneyMinorUnits(amountCents, currency) : "Payment"}
          </Button>
        </FieldRow>

        <div className="mt-field flex items-center justify-between text-caption text-fg-tertiary">
          <span>Prefilled oldest due first. Edit any Apply cell.</span>
          <Button type="button" variant="ghost" size="sm" onClick={resetAllocations}>
            <RotateCcw className="size-icon-sm" aria-hidden />
            Reset
          </Button>
        </div>
      </div>
    </aside>
  );
}
