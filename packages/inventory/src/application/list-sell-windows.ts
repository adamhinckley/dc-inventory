import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { projectLiveSellWindowStatus } from "../domain/sell-window.js";
import type {
  ISellWindowRepository,
  ListSellWindowsQuery,
  SellWindowListPage,
  SellWindowListSortBy,
  SortOrder,
} from "../domain/ports/sell-window-repository.js";

export type ListSellWindowsRequest = {
  organizationId: OrganizationId;
  page: number;
  pageSize: number;
  sortBy?: SellWindowListSortBy;
  sortOrder?: SortOrder;
};

export type ListSellWindowsResult = SellWindowListPage & {
  page: number;
  pageSize: number;
};

export class ListSellWindowsUseCase {
  constructor(
    private readonly sellWindows: ISellWindowRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: ListSellWindowsRequest): Promise<ListSellWindowsResult> {
    const query: ListSellWindowsQuery = {
      organizationId: input.organizationId,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy ?? "appliedAt",
      sortOrder: input.sortOrder ?? "desc",
    };
    const page = await this.sellWindows.list(query);
    const now = this.clock.now();
    return {
      items: page.items.map((window) => projectLiveSellWindowStatus(window, now)),
      total: page.total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
}
