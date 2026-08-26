import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { Contact } from "../domain/contact.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type ListContactsRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
};

export type ListContactsResult =
  | { ok: true; items: Contact[] }
  | { ok: false; reason: "not_found" };

export class ListContactsUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly contacts: IContactRepository,
  ) {}

  async execute(input: ListContactsRequest): Promise<ListContactsResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, items: await this.contacts.listByCustomer(input.customerId) };
  }
}
