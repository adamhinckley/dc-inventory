import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { Contact } from "../contact.js";
import type { ContactId } from "../ids.js";

export interface IContactRepository {
  listByCustomer(customerId: CustomerId): Promise<Contact[]>;
  findById(id: ContactId): Promise<Contact | null>;
  findByCustomerAndEmail(
    customerId: CustomerId,
    email: string,
  ): Promise<Contact | null>;
  save(contact: Contact): Promise<void>;
  deleteByCustomerId(customerId: CustomerId): Promise<void>;
}
