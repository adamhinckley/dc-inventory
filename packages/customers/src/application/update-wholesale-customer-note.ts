import type { CustomerId, OrganizationId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../domain/customer.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type UpdateWholesaleCustomerNoteRequest = {
  organizationId: OrganizationId;
  wholesaleUserId: WholesaleUserId;
  customerId: CustomerId;
  customerNote: string | null;
};

export type UpdateWholesaleCustomerNoteResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "not_found" };

function optionalText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export class UpdateWholesaleCustomerNoteUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(
    input: UpdateWholesaleCustomerNoteRequest,
  ): Promise<UpdateWholesaleCustomerNoteResult> {
    void input.wholesaleUserId;
    const existing = await this.customers.findById(input.organizationId, input.customerId);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    const customer: Customer = {
      ...existing,
      customerNote: optionalText(input.customerNote),
    };
    await this.customers.save(customer);
    return { ok: true, customer };
  }
}
