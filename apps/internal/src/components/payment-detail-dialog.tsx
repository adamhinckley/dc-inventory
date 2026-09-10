"use client";

import { Button, Chip, DescriptionList, Dialog, formatMoneyMinorUnits } from "@dc-inventory/ui";
import { ArrowLeftRight, Ban } from "lucide-react";
import type { CSSProperties } from "react";
import { accountingPaymentMethodLabel } from "../lib/accounting-display";
import { formatNullableDate } from "../lib/customer-accounting-format";
import {
  paymentDetailText,
  type PaymentDetailRecord,
} from "../lib/payment-detail";

export function PaymentReceivedDateButton({
  receivedAt,
  onClick,
}: {
  receivedAt: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="text-link hover:text-link-hover tabular-nums"
      data-testid="payment-received-date"
      onClick={onClick}
    >
      {formatNullableDate(receivedAt)}
    </button>
  );
}

export function PaymentDetailDialog({
  payment,
  invoiceNumbers,
  open,
  onOpenChange,
  canApplyPayments,
  canArAdjust,
  onReallocate,
  onVoid,
}: {
  payment: PaymentDetailRecord | null;
  invoiceNumbers: ReadonlyMap<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canApplyPayments: boolean;
  canArAdjust: boolean;
  onReallocate: (payment: PaymentDetailRecord) => void;
  onVoid: (payment: PaymentDetailRecord) => void;
}) {
  if (!payment) {
    return null;
  }

  const showActions = !payment.voided && (canApplyPayments || canArAdjust);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="xl" className="overlay" data-testid="payment-detail-dialog">
        <Dialog.Header>
          <Dialog.Title>Payment Detail</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <DescriptionList variant="secondary" maxColumns={2} data-testid="payment-detail-fields">
            <DescriptionList.Item>
              <DescriptionList.Term>Received</DescriptionList.Term>
              <DescriptionList.Data>
                <span className="tabular-nums">{formatNullableDate(payment.receivedAt)}</span>
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Amount</DescriptionList.Term>
              <DescriptionList.Data>
                <span
                  className={`font-semibold tabular-nums ${
                    payment.voided ? "text-fg-muted line-through" : ""
                  }`}
                >
                  {formatMoneyMinorUnits(payment.amountCents, payment.currency)}
                </span>
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Method</DescriptionList.Term>
              <DescriptionList.Data>
                {accountingPaymentMethodLabel(payment.method)}
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Reference</DescriptionList.Term>
              <DescriptionList.Data>{paymentDetailText(payment.reference)}</DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Applied</DescriptionList.Term>
              <DescriptionList.Data>
                <span className="tabular-nums">
                  {payment.voided
                    ? "—"
                    : formatMoneyMinorUnits(payment.appliedCents, payment.currency)}
                </span>
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Unapplied</DescriptionList.Term>
              <DescriptionList.Data>
                <span className="tabular-nums">
                  {payment.voided || payment.unappliedCents <= 0
                    ? "—"
                    : formatMoneyMinorUnits(payment.unappliedCents, payment.currency)}
                </span>
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Status</DescriptionList.Term>
              <DescriptionList.Data>
                {payment.voided ? (
                  <Chip
                    icon={<Chip.Dot />}
                    style={
                      { "--chip-color": "var(--color-fg-tertiary)" } as CSSProperties
                    }
                  >
                    Voided
                  </Chip>
                ) : (
                  "Posted"
                )}
              </DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Void reason</DescriptionList.Term>
              <DescriptionList.Data>{paymentDetailText(payment.voidReason)}</DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Note</DescriptionList.Term>
              <DescriptionList.Data>{paymentDetailText(payment.note)}</DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Applied to</DescriptionList.Term>
              <DescriptionList.Data>
                {payment.applications.length === 0 ? (
                  "—"
                ) : (
                  <ul className="flex flex-col gap-tight">
                    {payment.applications.map((application) => (
                      <li key={application.id} className="tabular-nums">
                        {invoiceNumbers.get(application.invoiceId) ?? application.invoiceId}{" "}
                        {formatMoneyMinorUnits(application.amountCents, application.currency)}
                      </li>
                    ))}
                  </ul>
                )}
              </DescriptionList.Data>
            </DescriptionList.Item>
          </DescriptionList>
        </Dialog.Body>
        {showActions ? (
          <Dialog.Footer>
            {canApplyPayments ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onReallocate(payment)}
              >
                <ArrowLeftRight className="size-icon" aria-hidden />
                Reallocate
              </Button>
            ) : null}
            {canArAdjust ? (
              <Button type="button" variant="primary" onClick={() => onVoid(payment)}>
                <Ban className="size-icon" aria-hidden />
                Void
              </Button>
            ) : null}
          </Dialog.Footer>
        ) : null}
      </Dialog.Content>
    </Dialog>
  );
}
