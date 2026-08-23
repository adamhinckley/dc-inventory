import type { CustomerId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { Contact } from "../domain/contact.js";
import { normalizeEmail } from "../domain/email.js";
import { ContactId, newUuid } from "../domain/ids.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type CreateContactRequest = {
  staffUserId: StaffUserId;
  customerId: CustomerId;
  name: string;
  email: string;
  phone?: string | null;
};

export type CreateContactResult =
  | { ok: true; contact: Contact }
  | { ok: false; reason: "not_found" | "duplicate_email" | "invalid" };

export class CreateContactUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly contacts: IContactRepository,
  ) {}

  async execute(input: CreateContactRequest): Promise<CreateContactResult> {
    void input.staffUserId;
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    if (name.length === 0 || email.length === 0 || !email.includes("@")) {
      return { ok: false, reason: "invalid" };
    }
    const customer = await this.customers.findById(input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.contacts.findByCustomerAndEmail(input.customerId, email);
    if (existing !== null) {
      return { ok: false, reason: "duplicate_email" };
    }
    const phone = input.phone?.trim() ?? "";
    const contact: Contact = {
      id: ContactId.parse(newUuid()),
      customerId: input.customerId,
      name,
      email,
      phone: phone.length === 0 ? null : phone,
    };
    await this.contacts.save(contact);
    return { ok: true, contact };
  }
}
