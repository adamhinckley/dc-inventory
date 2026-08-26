import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../domain/customer.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type GetCustomerRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
};

export type GetCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "not_found" };

export class GetCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(input: GetCustomerRequest): Promise<GetCustomerResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, customer };
  }
}
