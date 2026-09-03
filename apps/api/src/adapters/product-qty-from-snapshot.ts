import { productQtyFromStaffCatalogProjection, type ProductQty } from "@dc-inventory/catalog";
import {
  projectStaffCatalogQtyFromSnapshot,
  type StaffCatalogQtySnapshotRow,
} from "@dc-inventory/inventory";

export type InventorySnapshotQtyRow = StaffCatalogQtySnapshotRow;

/** Pass-through projection from persisted inventory snapshot columns to catalog qty. */
export function productQtyFromSnapshotRow(
  row: InventorySnapshotQtyRow,
  now: Date,
): ProductQty {
  return productQtyFromStaffCatalogProjection(projectStaffCatalogQtyFromSnapshot(row, now));
}
