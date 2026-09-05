import { LocationId, OrganizationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IUncoveredCaseQtyReadPort,
  IUncoveredReorderPolicyReadPort,
} from "../domain/ports/uncovered-stock-context.js";
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
  constructor(
    private readonly uncoveredList: IUncoveredListQuery,
    private readonly caseQty: IUncoveredCaseQtyReadPort,
    private readonly reorderPolicies: IUncoveredReorderPolicyReadPort,
  ) {}

  async execute(input: ListUncoveredSkusRequest): Promise<ListUncoveredSkusResult> {
    const organizationId = requireOrganizationId(input.organizationId);
    const resolvedLocationId = input.locationId ?? LocationId.DEFAULT;
    const page = await this.uncoveredList.list({
      organizationId,
      locationId: resolvedLocationId,
      page: input.page,
      pageSize: input.pageSize,
    });
    const skus = page.items.map((row) => row.sku);
    const [packaging, reorderPolicies] = await Promise.all([
      this.caseQty.readBySkus(organizationId, skus),
      this.reorderPolicies.readBySkus(organizationId, resolvedLocationId, skus),
    ]);
    return {
      items: page.items.map((row) => {
        const pack = packaging.get(row.sku.value);
        const policy = reorderPolicies.get(row.sku.value);
        return {
          sku: row.sku,
          committed: row.committed,
          onHand: row.onHand,
          onOrder: row.onOrder,
          uncovered: row.uncovered,
          caseQty: pack?.caseQty ?? null,
          reorderMin: policy?.reorderMin ?? null,
          reorderMax: policy?.reorderMax ?? null,
        };
      }),
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
