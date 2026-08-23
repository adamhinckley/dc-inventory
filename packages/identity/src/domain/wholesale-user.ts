import type { CustomerId, WholesaleUserId } from "@dc-inventory/shared-kernel";

export type WholesaleUser = {
  id: WholesaleUserId;
  email: string;
  passwordHash: string;
  customerId: CustomerId;
};
