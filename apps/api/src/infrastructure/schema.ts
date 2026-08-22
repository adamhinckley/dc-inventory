/**
 * Drizzle table models — one Postgres schema per bounded context.
 * Kit home stays in the API app. ADA-52 adds catalog / purchasing / inventory.
 */
export {
  catalog,
  categories,
  identifierKind,
  productCategories,
  productIdentifiers,
  productImages,
  productPackaging,
  products,
} from "./schema/catalog.js";
export {
  purchaseOrderLines,
  purchaseOrders,
  purchasing,
  supplierProducts,
  suppliers,
} from "./schema/purchasing.js";
export {
  inventory,
  locations,
  movementRefType,
  movementType,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
} from "./schema/inventory.js";

import {
  categories,
  productCategories,
  productIdentifiers,
  productImages,
  productPackaging,
  products,
} from "./schema/catalog.js";
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierProducts,
  suppliers,
} from "./schema/purchasing.js";
import {
  locations,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
} from "./schema/inventory.js";

export const schema = {
  products,
  productIdentifiers,
  productPackaging,
  categories,
  productCategories,
  productImages,
  suppliers,
  supplierProducts,
  purchaseOrders,
  purchaseOrderLines,
  locations,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
};
