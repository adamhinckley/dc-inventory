import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { Contact } from "../domain/contact.js";
import { normalizeEmail } from "../domain/email.js";
import type { ContactId } from "../domain/ids.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";

export class InMemoryContactRepository implements IContactRepository {
  private readonly byId = new Map<ContactId, Contact>();

  async listByCustomer(customerId: CustomerId): Promise<Contact[]> {
    return [...this.byId.values()].filter((row) => row.customerId === customerId);
  }

  async findById(id: ContactId): Promise<Contact | null> {
    return this.byId.get(id) ?? null;
  }

  async findByCustomerAndEmail(
    customerId: CustomerId,
    email: string,
  ): Promise<Contact | null> {
    const normalized = normalizeEmail(email);
    return (
      [...this.byId.values()].find(
        (row) => row.customerId === customerId && row.email === normalized,
      ) ?? null
    );
  }

  async save(contact: Contact): Promise<void> {
    this.byId.set(contact.id, { ...contact, email: normalizeEmail(contact.email) });
  }
}
