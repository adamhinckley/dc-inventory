/**
 * Catalog tables live in `@dc-inventory/catalog`. Re-export for leftover
 * local imports; the Kit barrel should import the package `./schema` entry.
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
} from "@dc-inventory/catalog/schema";
