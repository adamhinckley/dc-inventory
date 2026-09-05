import { LocationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IUncoveredListQuery,
  UncoveredListCoreRow,
  UncoveredListQuery,
} from "../domain/ports/uncovered-list-query.js";
import type { InMemoryInventoryReadModel } from "./in-memory-inventory-read-model.js";

function compareRowsBySku(a: UncoveredListCoreRow, b: UncoveredListCoreRow): number {
  return a.sku.value.localeCompare(b.sku.value);
}

export class InMemoryUncoveredListQuery implements IUncoveredListQuery {
  constructor(private readonly readModel: InMemoryInventoryReadModel) {}

  async list(query: UncoveredListQuery) {
    const organizationId = requireOrganizationId(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const rows = this.readModel
      .listOrganizationSnapshots(organizationId, locationId)
      .filter((row) => row.snapshot.uncovered > 0)
      .map(
        (row): UncoveredListCoreRow =>
          Object.freeze({
            sku: row.sku,
            committed: row.snapshot.committed,
            onHand: row.snapshot.onHand,
            onOrder: row.snapshot.onOrder,
            uncovered: row.snapshot.uncovered,
          }),
      );
    rows.sort(compareRowsBySku);
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(offset, offset + query.pageSize),
      total: rows.length,
    };
  }
}
