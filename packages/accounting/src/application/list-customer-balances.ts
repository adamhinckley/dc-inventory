import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  CustomerBalancesListQuery,
  CustomerBalancesListPage,
  CustomerBalancesSortBy,
  ICustomerBalancesListQuery,
  SortOrder,
} from "../domain/ports/customer-balances-list-query.js";

export type ListCustomerBalancesRequest = {
  readonly organizationId: OrganizationId;
  readonly asOf: Date;
  readonly bucket?: CustomerBalancesListQuery["bucket"];
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: CustomerBalancesSortBy;
  readonly sortOrder?: SortOrder;
};

export type ListCustomerBalancesResult = CustomerBalancesListPage & {
  readonly page: number;
  readonly pageSize: number;
};

export class ListCustomerBalancesQuery {
  constructor(private readonly customerBalancesList: ICustomerBalancesListQuery) {}

  async execute(input: ListCustomerBalancesRequest): Promise<ListCustomerBalancesResult> {
    const page = await this.customerBalancesList.list({
      organizationId: input.organizationId,
      asOf: input.asOf,
      bucket: input.bucket,
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy ?? "pastDue",
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
