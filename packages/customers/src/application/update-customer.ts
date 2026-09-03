import { Money, type CustomerId, type OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { isAccountStatus } from "../domain/account-status.js";
import type { Customer } from "../domain/customer.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type UpdateCustomerRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
  name?: string;
  creditLimitCents?: number;
  currency?: string;
  terms?: string;
  taxId?: string | null;
  accountStatus?: string;
  customerNote?: string | null;
  staffNote?: string | null;
};

export type UpdateCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "not_found" | "invalid" };

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class UpdateCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(input: UpdateCustomerRequest): Promise<UpdateCustomerResult> {
    void input.staffUserId;
    const existing = await this.customers.findById(input.organizationId, input.customerId);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    const name = input.name === undefined ? existing.name : input.name.trim();
    const terms = input.terms === undefined ? existing.terms : input.terms.trim();
    if (name.length === 0 || terms.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    if (input.accountStatus !== undefined && !isAccountStatus(input.accountStatus)) {
      return { ok: false, reason: "invalid" };
    }
    try {
      const currency = input.currency ?? existing.creditLimit.currency;
      const cents = input.creditLimitCents ?? existing.creditLimit.amountMinor;
      const customer: Customer = {
        id: existing.id,
        organizationId: existing.organizationId,
        name,
        customerNumber: existing.customerNumber,
        creditLimit: Money.fromMinorUnits(cents, currency),
        terms,
        taxId: input.taxId === undefined ? existing.taxId : optionalText(input.taxId) ?? null,
        accountStatus:
          input.accountStatus === undefined
            ? existing.accountStatus
            : input.accountStatus,
        customerNote:
          input.customerNote === undefined
            ? existing.customerNote
            : optionalText(input.customerNote) ?? null,
        staffNote:
          input.staffNote === undefined ? existing.staffNote : optionalText(input.staffNote) ?? null,
        createdAt: existing.createdAt,
      };
      await this.customers.save(customer);
      return { ok: true, customer };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
}
