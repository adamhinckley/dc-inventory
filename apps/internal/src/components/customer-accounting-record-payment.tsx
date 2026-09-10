"use client";

import {
  useRecordInternalCustomerPayment,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Checkbox,
  DateInput,
  Dialog,
  Input,
  Label,
  LabeledField,
  Select,
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
  sortInvoicesOldestDueFirst,
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
  canApplyPayments,
  open,
  onOpenChange,
}: {
  customerId: string;
  openInvoices: AllocationInvoice[];
  currency: string;
  canApplyPayments: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [submitFailed, setSubmitFailed] = useState(false);

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
    !canApplyPayments ||
    isPending ||
    recordPaymentSubmitDisabled({
      amountCents,
      allocatedCents,
      holdRemainderAsCredit,
      allocations,
      invoices: openInvoices,
    });

  const rotateIdempotencyKeyAfterFailure = useCallback(() => {
    if (submitFailed) {
      setIdempotencyKey(createIdempotencyKey());
      setSubmitFailed(false);
    }
  }, [submitFailed]);

  useEffect(() => {
    if (remainderCents <= 0) {
      setHoldRemainderAsCredit(false);
    }
  }, [remainderCents]);

  const resetForm = useCallback(() => {
    setAmountInput("");
    setMethod("check");
    setReference("");
    setNote("");
    setReceivedDate(todayIsoDate());
    setHoldRemainderAsCredit(false);
    setApplyOverrides({});
    setSubmitFailed(false);
    setSubmitError(null);
    setIdempotencyKey(createIdempotencyKey());
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        resetForm();
      }
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  const resetAllocations = useCallback(() => {
    rotateIdempotencyKeyAfterFailure();
    setApplyOverrides({});
    setSubmitError(null);
  }, [rotateIdempotencyKeyAfterFailure]);

  const handleAmountChange = useCallback(
    (value: string) => {
      rotateIdempotencyKeyAfterFailure();
      setAmountInput(value);
      setApplyOverrides({});
      setSubmitError(null);
    },
    [rotateIdempotencyKeyAfterFailure],
  );

  const handleApplyChange = useCallback(
    (invoiceId: string, value: string) => {
      rotateIdempotencyKeyAfterFailure();
      const cents = parseDollarsToCents(value);
      setApplyOverrides((current) => ({
        ...current,
        [invoiceId]: cents,
      }));
      setSubmitError(null);
    },
    [rotateIdempotencyKeyAfterFailure],
  );

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
        setSubmitFailed(true);
        setSubmitError("Could not record payment. Check the amounts and try again.");
        return;
      }
      await invalidateCustomerAccountingQueries(queryClient, customerId);
      resetForm();
      onOpenChange(false);
    } catch {
      setSubmitFailed(true);
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
    onOpenChange,
    queryClient,
    receivedDate,
    recordPayment,
    reference,
    resetForm,
  ]);

  const sortedInvoices = useMemo(
    () => sortInvoicesOldestDueFirst(openInvoices),
    [openInvoices],
  );

  if (!canApplyPayments) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content size="lg" data-testid="customer-accounting-record-payment">
        <Dialog.Header>
          <Dialog.Title>Record Payment</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
        <div className="grid grid-cols-1 gap-field-group sm:grid-cols-2">
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
            <Select
              id="record-payment-method"
              value={method}
              onChange={(next) => {
                rotateIdempotencyKeyAfterFailure();
                if (next) {
                  setMethod(next);
                }
              }}
              options={[...PAYMENT_METHOD_OPTIONS]}
            />
          </LabeledField>
          <LabeledField>
            <Label htmlFor="record-payment-reference">Reference</Label>
            <Input
              id="record-payment-reference"
              value={reference}
              onChange={(event) => {
                rotateIdempotencyKeyAfterFailure();
                setReference(event.target.value);
                setSubmitError(null);
              }}
              placeholder="Check #"
            />
          </LabeledField>
          <LabeledField>
            <Label htmlFor="record-payment-received">Received</Label>
            <DateInput
              id="record-payment-received"
              value={receivedDate}
              onChange={(value) => {
                rotateIdempotencyKeyAfterFailure();
                setReceivedDate(value);
                setSubmitError(null);
              }}
              yearNavigation
              min="2020-01-01"
              max="2040-12-31"
            />
          </LabeledField>
          <LabeledField className="sm:col-span-2">
            <Label htmlFor="record-payment-note">Note</Label>
            <Input
              id="record-payment-note"
              value={note}
              onChange={(event) => {
                rotateIdempotencyKeyAfterFailure();
                setNote(event.target.value);
                setSubmitError(null);
              }}
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
              onChange={(checked) => {
                rotateIdempotencyKeyAfterFailure();
                setHoldRemainderAsCredit(checked);
                setSubmitError(null);
              }}
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

        <p className="mt-field text-caption text-fg-tertiary">
          Prefilled oldest due first. Edit any Apply cell.
        </p>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mr-auto"
            onClick={resetAllocations}
          >
            <RotateCcw className="size-icon-sm" aria-hidden />
            Reset
          </Button>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={submitDisabled}
            onClick={() => void handleSubmit()}
            data-testid="customer-accounting-record-payment-submit"
          >
            <CircleDollarSign className="size-icon" aria-hidden />
            Record {amountCents > 0 ? formatMoneyMinorUnits(amountCents, currency) : "Payment"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
