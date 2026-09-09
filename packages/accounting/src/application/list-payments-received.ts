import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IPaymentsReceivedListQuery,
  PaymentsReceivedListPage,
  PaymentsReceivedSortBy,
  SortOrder,
} from "../domain/ports/payments-received-list-query.js";

export type ListPaymentsReceivedRequest = {
  readonly organizationId: OrganizationId;
  readonly from: Date;
  readonly to: Date;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: PaymentsReceivedSortBy;
  readonly sortOrder?: SortOrder;
};

export type ListPaymentsReceivedResult = PaymentsReceivedListPage & {
  readonly page: number;
  readonly pageSize: number;
};

export class ListPaymentsReceivedQuery {
  constructor(private readonly paymentsReceivedList: IPaymentsReceivedListQuery) {}

  async execute(input: ListPaymentsReceivedRequest): Promise<ListPaymentsReceivedResult> {
    const page = await this.paymentsReceivedList.list({
      organizationId: input.organizationId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy ?? "receivedAt",
      sortOrder: input.sortOrder ?? "desc",
    });
    return {
      items: [...page.items],
      total: page.total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
}
