import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { PaymentId } from "../ids.js";
import type { PaymentMethod } from "../invoice.js";

export type PaymentsReceivedSortBy = "receivedAt" | "amount" | "customerName";
export type SortOrder = "asc" | "desc";

export type PaymentsReceivedListQuery = {
  readonly organizationId: OrganizationId;
  readonly from: Date;
  readonly to: Date;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: PaymentsReceivedSortBy;
  readonly sortOrder: SortOrder;
};

export type PaymentReceivedRow = {
  readonly paymentId: PaymentId;
  readonly receivedAt: Date;
  readonly customerId: CustomerId;
  readonly customerNumber: string;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly reference: string | null;
  readonly appliedCents: number;
  readonly unappliedCents: number;
  readonly voided: boolean;
};

export type PaymentsReceivedListPage = {
  readonly items: readonly PaymentReceivedRow[];
  readonly total: number;
};

export interface IPaymentsReceivedListQuery {
  list(query: PaymentsReceivedListQuery): Promise<PaymentsReceivedListPage>;
}
