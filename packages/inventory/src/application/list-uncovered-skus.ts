import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IUncoveredListQuery,
  UncoveredListRow,
} from "../domain/ports/uncovered-list-query.js";

export type ListUncoveredSkusRequest = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
};

export type ListUncoveredSkusResult = {
  items: UncoveredListRow[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListUncoveredSkusUseCase {
  constructor(private readonly uncoveredList: IUncoveredListQuery) {}

  async execute(input: ListUncoveredSkusRequest): Promise<ListUncoveredSkusResult> {
    const page = await this.uncoveredList.list({
      organizationId: input.organizationId,
      locationId: input.locationId,
      page: input.page,
      pageSize: input.pageSize,
    });
    return {
      items: [...page.items],
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
