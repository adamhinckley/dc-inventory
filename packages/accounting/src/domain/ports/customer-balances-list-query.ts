import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { AgingBucket } from "../invoice.js";

export type CustomerBalancesSortBy =
  | "pastDue"
  | "openBalance"
  | "name"
  | "customerNumber"
  | "oldestDue"
  | "daysPastDue"
  | "creditLimit"
  | "availableCredit";

export type SortOrder = "asc" | "desc";

export type CustomerBalancesListQuery = {
  readonly organizationId: OrganizationId;
  readonly asOf: Date;
  readonly bucket?: AgingBucket;
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: CustomerBalancesSortBy;
  readonly sortOrder: SortOrder;
};

export type CustomerBalanceRow = {
  readonly customerId: CustomerId;
  readonly customerNumber: string;
  readonly name: string;
  readonly openBalanceCents: number;
  readonly pastDueCents: number;
  readonly oldestDueDate: Date | null;
  readonly daysPastDue: number;
  readonly creditLimitCents: number;
  readonly availableCreditCents: number;
  readonly hasActivePlan: boolean;
};

export type CustomerBalancesListPage = {
  readonly items: readonly CustomerBalanceRow[];
  readonly total: number;
};

export interface ICustomerBalancesListQuery {
  list(query: CustomerBalancesListQuery): Promise<CustomerBalancesListPage>;
}
