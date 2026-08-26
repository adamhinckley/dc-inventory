import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { Contact } from "../domain/contact.js";
import { normalizeEmail } from "../domain/email.js";
import type { ContactId } from "../domain/ids.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type UpdateContactRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
  contactId: ContactId;
  name?: string;
  email?: string;
  phone?: string | null;
};

export type UpdateContactResult =
  | { ok: true; contact: Contact }
  | { ok: false; reason: "not_found" | "duplicate_email" | "invalid" };

export class UpdateContactUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly contacts: IContactRepository,
  ) {}

  async execute(input: UpdateContactRequest): Promise<UpdateContactResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.contacts.findById(input.contactId);
    if (existing === null || existing.customerId !== input.customerId) {
      return { ok: false, reason: "not_found" };
    }
    const name = input.name === undefined ? existing.name : input.name.trim();
    const email =
      input.email === undefined ? existing.email : normalizeEmail(input.email);
    if (name.length === 0 || email.length === 0 || !email.includes("@")) {
      return { ok: false, reason: "invalid" };
    }
    if (email !== existing.email) {
      const clash = await this.contacts.findByCustomerAndEmail(input.customerId, email);
      if (clash !== null && clash.id !== existing.id) {
        return { ok: false, reason: "duplicate_email" };
      }
    }
    let phone = existing.phone;
    if (input.phone !== undefined) {
      const trimmed = input.phone?.trim() ?? "";
      phone = trimmed.length === 0 ? null : trimmed;
    }
    const contact: Contact = {
      id: existing.id,
      customerId: existing.customerId,
      name,
      email,
      phone,
    };
    await this.contacts.save(contact);
    return { ok: true, contact };
  }
}
