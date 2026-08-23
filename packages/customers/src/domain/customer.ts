import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { Money } from "@dc-inventory/shared-kernel";

export type Customer = {
  id: CustomerId;
  name: string;
  creditLimit: Money;
  terms: string;
};
