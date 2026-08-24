import type { InvoiceId, OrderId } from "@dc-inventory/shared-kernel";
import type { PaymentId } from "./ids.js";

export type AccountingErrorReason =
  | "not_found"
  | "invalid"
  | "conflict"
  | "overpay"
  | "wrong_currency";

export class AccountingDomainError extends Error {
  constructor(public readonly reason: AccountingErrorReason) {
    super(reason);
    this.name = "AccountingDomainError";
  }
}

export function duplicateInvoiceForOrder(orderId: OrderId): AccountingDomainError {
  void orderId;
  return new AccountingDomainError("conflict");
}

export function invoiceNotFound(id: InvoiceId): AccountingDomainError {
  void id;
  return new AccountingDomainError("not_found");
}

export function paymentNotFound(id: PaymentId): AccountingDomainError {
  void id;
  return new AccountingDomainError("not_found");
}
