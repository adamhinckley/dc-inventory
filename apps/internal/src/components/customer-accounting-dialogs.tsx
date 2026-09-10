"use client";

import {
  useAdjustInternalInvoice,
  useEndInternalCustomerPaymentPlan,
  useReallocateInternalPayment,
  useSetInternalCustomerPaymentPlan,
  useVoidInternalPayment,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Dialog,
  FieldRow,
  Form,
  FormDialog,
  Input,
  Label,
  LabeledField,
  Select,
  formatMoneyMinorUnits,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, CalendarClock, FileMinus, HandCoins } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import {
  formatCentsInputValue,
  formatNullableDate,
  parseDollarsToCents,
  parseSignedDollarsToCents,
  todayIsoDate,
} from "../lib/customer-accounting-format";
import { invalidateCustomerAccountingQueries } from "../lib/customer-accounting-queries";
import type {
  CustomerInvoiceRow,
  CustomerPaymentRow,
} from "../lib/customer-accounting-types";

const adjustSchema = z.object({
  kind: z.enum(["write_off", "credit_memo"]),
  amountDollars: z.string().min(1),
  reason: z.string().min(1),
});

const planSchema = z.object({
  frequency: z.enum(["weekly", "monthly"]),
  installmentDollars: z.string().min(1),
  startsOn: z.string().min(1),
});

type AdjustDialogProps = {
  customerId: string;
  invoice: CustomerInvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CustomerAccountingAdjustDialog({
  customerId,
  invoice,
  open,
  onOpenChange,
}: AdjustDialogProps) {
  const queryClient = useQueryClient();
  const { mutateAsync } = useAdjustInternalInvoice();

  if (!invoice) {
    return null;
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust Invoice"
      schema={adjustSchema}
      defaultValues={{
        kind: "credit_memo",
        amountDollars: "",
        reason: "",
      }}
      mutate={async (data) => {
        const response = await mutateAsync({
          id: invoice.id,
          data: {
            kind: data.kind,
            amountCents: parseSignedDollarsToCents(data.amountDollars),
            reason: data.reason.trim(),
          },
        });
        if (response.status !== 200) {
          throw new Error("adjust_failed");
        }
        return response;
      }}
      successMessage="Invoice adjusted"
      onSuccess={async () => {
        await invalidateCustomerAccountingQueries(queryClient, customerId);
      }}
      submitLabel="Adjust Invoice"
      data-testid="customer-accounting-adjust-dialog"
    >
      <p className="text-body-sm text-fg-secondary">
        {invoice.documentNumber} · remaining{" "}
        {formatCentsInputValue(invoice.remainingCents)}
      </p>
      <Form.Field
        name="kind"
        label="Kind"
        required
        form={{
          kind: "select",
          options: [
            { value: "credit_memo", label: "Credit memo" },
            { value: "write_off", label: "Write-off" },
          ],
        }}
      />
      <Form.Field
        name="amountDollars"
        label="Amount"
        required
        form={{ kind: "text" }}
      />
      <Form.Field name="reason" label="Reason" required form={{ kind: "text" }} />
    </FormDialog>
  );
}

export function CustomerAccountingVoidDialog({
  customerId,
  payment,
  open,
  onOpenChange,
  onSuccess,
}: {
  customerId: string;
  payment: CustomerPaymentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useVoidInternalPayment();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setReason("");
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        reset();
      }
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const handleSubmit = useCallback(async () => {
    if (!payment || reason.trim().length === 0) {
      setError("A reason is required to void this payment.");
      return;
    }
    setError(null);
    try {
      const response = await mutateAsync({
        id: payment.id,
        data: { voidReason: reason.trim() },
      });
      if (response.status !== 200) {
        setError("Could not void payment.");
        return;
      }
      await invalidateCustomerAccountingQueries(queryClient, customerId);
      handleOpenChange(false);
      onSuccess?.();
    } catch {
      setError("Could not void payment.");
    }
  }, [customerId, handleOpenChange, mutateAsync, onSuccess, payment, queryClient, reason]);

  if (!payment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content
        size="sm"
        className="overlay border-error"
        data-testid="customer-accounting-void-dialog"
      >
        <Dialog.Header>
          <Dialog.Title>Void Payment</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <Dialog.Description className="text-error">
            This permanently voids the payment. Amount is never edited — void and
            re-enter if the amount was wrong.
          </Dialog.Description>
          <LabeledField className="mt-field">
            <Label htmlFor="void-payment-reason">Reason</Label>
            <Input
              id="void-payment-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </LabeledField>
          {error ? <p className="mt-tight text-body-sm text-error">{error}</p> : null}
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isPending}
            onClick={() => void handleSubmit()}
          >
            <FileMinus className="size-icon" aria-hidden />
            Void Payment
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

export function CustomerAccountingReallocateDialog({
  customerId,
  payment,
  openInvoices,
  open,
  onOpenChange,
  title = "Reallocate Payment",
  onSuccess,
}: {
  customerId: string;
  payment: CustomerPaymentRow | null;
  openInvoices: CustomerInvoiceRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useReallocateInternalPayment();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTargets({});
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        reset();
      }
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const applications = useMemo(
    () =>
      Object.entries(targets)
        .map(([invoiceId, value]) => ({
          invoiceId,
          deltaCents: parseSignedDollarsToCents(value),
        }))
        .filter((row) => row.deltaCents !== 0),
    [targets],
  );

  const handleSubmit = useCallback(async () => {
    if (!payment) {
      return;
    }
    if (applications.length === 0) {
      setError("Enter at least one non-zero application.");
      return;
    }
    setError(null);
    try {
      const response = await mutateAsync({
        id: payment.id,
        data: { applications },
      });
      if (response.status !== 200) {
        setError("Could not reallocate payment.");
        return;
      }
      await invalidateCustomerAccountingQueries(queryClient, customerId);
      handleOpenChange(false);
      onSuccess?.();
    } catch {
      setError("Could not reallocate payment.");
    }
  }, [
    applications,
    customerId,
    handleOpenChange,
    mutateAsync,
    onSuccess,
    payment,
    queryClient,
  ]);

  if (!payment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content size="md" data-testid="customer-accounting-reallocate-dialog">
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-body-sm text-fg-secondary">
            Unapplied {formatCentsInputValue(payment.unappliedCents)} on this payment.
            Enter signed amounts to move between invoices and unapplied credit.
          </p>
          <div className="mt-field flex flex-col gap-field">
            {openInvoices.map((invoice) => (
              <FieldRow key={invoice.id}>
                <LabeledField className="min-w-56 flex-1">
                  <Label htmlFor={`reallocate-${invoice.id}`}>
                    {invoice.documentNumber}
                  </Label>
                  <Input
                    id={`reallocate-${invoice.id}`}
                    value={targets[invoice.id] ?? ""}
                    onChange={(event) =>
                      setTargets((current) => ({
                        ...current,
                        [invoice.id]: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </LabeledField>
              </FieldRow>
            ))}
          </div>
          {error ? <p className="mt-tight text-body-sm text-error">{error}</p> : null}
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isPending}
            onClick={() => void handleSubmit()}
          >
            <ArrowLeftRight className="size-icon" aria-hidden />
            Save Reallocation
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

export function CustomerAccountingPlanDialog({
  customerId,
  currency,
  open,
  onOpenChange,
}: {
  customerId: string;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync } = useSetInternalCustomerPaymentPlan();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Payment Plan"
      schema={planSchema}
      defaultValues={{
        frequency: "monthly",
        installmentDollars: "",
        startsOn: todayIsoDate(),
      }}
      mutate={async (data) => {
        const response = await mutateAsync({
          id: customerId,
          data: {
            frequency: data.frequency,
            installmentAmountCents: parseDollarsToCents(data.installmentDollars),
            currency,
            startsOn: data.startsOn,
          },
        });
        if (response.status !== 200) {
          throw new Error("plan_failed");
        }
        return response;
      }}
      successMessage="Payment plan created"
      onSuccess={async () => {
        await invalidateCustomerAccountingQueries(queryClient, customerId);
      }}
      submitLabel="Create Plan"
      data-testid="customer-accounting-plan-dialog"
    >
      <Form.Field
        name="frequency"
        label="Frequency"
        required
        form={{
          kind: "select",
          options: [
            { value: "monthly", label: "Monthly" },
            { value: "weekly", label: "Weekly" },
          ],
        }}
      />
      <Form.Field
        name="installmentDollars"
        label="Installment amount"
        required
        form={{ kind: "text" }}
      />
      <Form.Field
        name="startsOn"
        label="Starts on"
        required
        form={{
          kind: "date",
          yearNavigation: true,
          min: "2020-01-01",
          max: "2040-12-31",
        }}
      />
    </FormDialog>
  );
}

export function CustomerAccountingEndPlanButton({
  customerId,
}: {
  customerId: string;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useEndInternalCustomerPaymentPlan();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    setError(null);
    try {
      const response = await mutateAsync({ id: customerId });
      if (response.status !== 204) {
        setError("Could not end payment plan.");
        return;
      }
      await invalidateCustomerAccountingQueries(queryClient, customerId);
      setOpen(false);
    } catch {
      setError("Could not end payment plan.");
    }
  }, [customerId, mutateAsync, queryClient]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <CalendarClock className="size-icon" aria-hidden />
        End Plan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Content size="sm" data-testid="customer-accounting-end-plan-dialog">
          <Dialog.Header>
            <Dialog.Title>End Payment Plan</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <Dialog.Description>
              End the active payment plan for this customer? Installments already
              received stay on the ledger.
            </Dialog.Description>
            {error ? <p className="mt-tight text-body-sm text-error">{error}</p> : null}
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isPending}
              onClick={() => void handleConfirm()}
            >
              <CalendarClock className="size-icon" aria-hidden />
              End Plan
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}

export function CustomerAccountingApplyCreditPickerDialog({
  payments,
  currency,
  open,
  onOpenChange,
  onSelect,
}: {
  payments: CustomerPaymentRow[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (payment: CustomerPaymentRow) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSelectedId(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const paymentOptions = useMemo(
    () =>
      payments.map((payment) => ({
        value: payment.id,
        label: `${formatNullableDate(payment.receivedAt)} · ${formatMoneyMinorUnits(payment.unappliedCents, currency)} unapplied${payment.reference ? ` · ${payment.reference}` : ""}`,
      })),
    [currency, payments],
  );

  const selectedPayment =
    payments.find((payment) => payment.id === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content size="sm" data-testid="customer-accounting-apply-credit-picker">
        <Dialog.Header>
          <Dialog.Title>Apply Credit</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-body-sm text-fg-secondary">
            Choose which payment&apos;s unapplied credit to apply.
          </p>
          <LabeledField className="mt-field">
            <Label htmlFor="apply-credit-payment">Payment</Label>
            <Select
              id="apply-credit-payment"
              value={selectedId}
              onChange={setSelectedId}
              options={paymentOptions}
              placeholder="Choose a payment"
            />
          </LabeledField>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!selectedPayment}
            onClick={() => {
              if (selectedPayment) {
                onSelect(selectedPayment);
                handleOpenChange(false);
              }
            }}
          >
            <HandCoins className="size-icon" aria-hidden />
            Continue
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
