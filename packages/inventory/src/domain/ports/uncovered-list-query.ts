import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";

export type UncoveredListQuery = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
};

export type UncoveredListRow = Readonly<{
  sku: Sku;
  committed: number;
  onHand: number;
  onOrder: number;
  uncovered: number;
}>;

export type UncoveredListPage = {
  items: readonly UncoveredListRow[];
  total: number;
};

/**
 * Paged read boundary for SKUs with factory to-order need
 * (`uncovered = max(0, committed − on_hand − on_order)`).
 */
export interface IUncoveredListQuery {
  list(query: UncoveredListQuery): Promise<UncoveredListPage>;
}
