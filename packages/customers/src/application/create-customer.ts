import { CustomerId, Money, type OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
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
};

export type CreateCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "invalid" };

export class CreateCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(input: CreateCustomerRequest): Promise<CreateCustomerResult> {
    void input.staffUserId;
    const name = input.name.trim();
    const terms = input.terms.trim();
    if (name.length === 0 || terms.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    try {
      const customer: Customer = {
        id: CustomerId.parse(newUuid()),
        organizationId: input.organizationId,
        name,
        creditLimit: Money.fromMinorUnits(input.creditLimitCents, input.currency ?? "USD"),
        terms,
        createdAt: new Date(),
      };
      await this.customers.save(customer);
      return { ok: true, customer };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
}
