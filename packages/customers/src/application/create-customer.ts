import {
  CustomerId,
  Money,
  type OrganizationId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import { isAccountStatus, type AccountStatus } from "../domain/account-status.js";
import type { Customer } from "../domain/customer.js";
import { newUuid } from "../domain/ids.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type CreateCustomerRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  name: string;
  creditLimitCents: number;
  currency?: string;
  terms: string;
  customerNumber?: string | null;
  taxId?: string | null;
  accountStatus?: AccountStatus;
  customerNote?: string | null;
  staffNote?: string | null;
};

export type CreateCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "invalid" | "duplicate_customer_number" };

function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class CreateCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(input: CreateCustomerRequest): Promise<CreateCustomerResult> {
    void input.staffUserId;
    const name = input.name.trim();
    const terms = input.terms.trim();
    if (name.length === 0 || terms.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const requestedNumber = optionalText(input.customerNumber);
    if (input.accountStatus !== undefined && !isAccountStatus(input.accountStatus)) {
      return { ok: false, reason: "invalid" };
    }
    try {
      let customerNumber: string;
      if (requestedNumber === null) {
        customerNumber = await this.customers.allocateNextCustomerNumber(input.organizationId);
      } else {
        const existing = await this.customers.findByCustomerNumber(
          input.organizationId,
          requestedNumber,
        );
        if (existing !== null) {
          return { ok: false, reason: "duplicate_customer_number" };
        }
        customerNumber = requestedNumber;
      }
      const customer: Customer = {
        id: CustomerId.parse(newUuid()),
        organizationId: input.organizationId,
        name,
        customerNumber,
        creditLimit: Money.fromMinorUnits(input.creditLimitCents, input.currency ?? "USD"),
        terms,
        taxId: optionalText(input.taxId),
        accountStatus: input.accountStatus ?? "active",
        customerNote: optionalText(input.customerNote),
        staffNote: optionalText(input.staffNote),
        createdAt: new Date(),
      };
      await this.customers.save(customer);
      return { ok: true, customer };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
}
