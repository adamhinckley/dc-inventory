import type { CustomerId, OrganizationId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../domain/customer.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type GetWholesaleCustomerRequest = {
  organizationId: OrganizationId;
  wholesaleUserId: WholesaleUserId;
  customerId: CustomerId;
};

export type GetWholesaleCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "not_found" };

export class GetWholesaleCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(input: GetWholesaleCustomerRequest): Promise<GetWholesaleCustomerResult> {
    void input.wholesaleUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, customer };
  }
}
