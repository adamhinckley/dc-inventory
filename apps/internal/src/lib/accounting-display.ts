import { formatMoneyMinorUnits } from "@dc-inventory/ui";
import type { AccountingPaymentMethod } from "./accounting-types";

const PAYMENT_METHOD_LABELS = {
  check: "Check",
  card: "Card",
  ach: "ACH",
  cash: "Cash",
  other: "Other",
} satisfies Record<AccountingPaymentMethod, string>;

export function accountingPaymentMethodLabel(method: AccountingPaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

export function accountingAppliedUnappliedLabel(input: {
  appliedCents: number;
  unappliedCents: number;
  currency: string;
  voided: boolean;
}): string {
  if (input.voided) {
    return "—";
  }
  const applied = formatMoneyMinorUnits(input.appliedCents, input.currency);
  if (input.unappliedCents <= 0) {
    return applied;
  }
  const unapplied = formatMoneyMinorUnits(input.unappliedCents, input.currency);
  return `${applied} / ${unapplied} unapplied`;
}

export function accountingCreditLimitLabel(
  creditLimitCents: number,
  currency: string,
): string {
  if (creditLimitCents === 0) {
    return "No credit";
  }
  return formatMoneyMinorUnits(creditLimitCents, currency);
}
