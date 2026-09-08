import {
  projectStaffCatalogQtyFromSnapshot,
  type EffectiveSellStateOptions,
  type StaffCatalogQtySnapshotRow,
} from "@dc-inventory/inventory";
import { productQtyFromStaffCatalogProjection, type ProductQty } from "@dc-inventory/catalog";

export type InventorySnapshotQtyRow = StaffCatalogQtySnapshotRow &
  Readonly<{
    hasActiveSellWindowMembership?: boolean;
  }>;

function effectiveSellStateOptions(
  row: InventorySnapshotQtyRow,
): EffectiveSellStateOptions | undefined {
  if (row.hasActiveSellWindowMembership === undefined) {
    return undefined;
  }
  return { hasActiveSellWindowMembership: row.hasActiveSellWindowMembership };
}

/** Pass-through projection from persisted inventory snapshot columns to catalog qty. */
export function productQtyFromSnapshotRow(
  row: InventorySnapshotQtyRow,
  now: Date,
): ProductQty {
  const projected = projectStaffCatalogQtyFromSnapshot(row, now, effectiveSellStateOptions(row));
  return productQtyFromStaffCatalogProjection({
    ...projected,
    stickyLocked: row.stickyLocked,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
    hasActiveSellWindowMembership: row.hasActiveSellWindowMembership,
  });
}
