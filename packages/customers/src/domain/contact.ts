import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ContactId } from "./ids.js";

export type Contact = {
  id: ContactId;
  customerId: CustomerId;
  name: string;
  email: string;
  phone: string | null;
};
