import type { CustomerId, Money, OrganizationId } from "@dc-inventory/shared-kernel";
import type { AccountStatus } from "./account-status.js";

export type Customer = {
  id: CustomerId;
  organizationId: OrganizationId;
  name: string;
  customerNumber: string;
  creditLimit: Money;
  terms: string;
  taxId: string | null;
  accountStatus: AccountStatus;
  customerNote: string | null;
  staffNote: string | null;
  createdAt: Date;
};
