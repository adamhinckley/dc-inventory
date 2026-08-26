import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { newUuid } from "./ids.js";

const PRODUCT_IMAGE_SEGMENT = "images";

/**
 * Builds a product image object-storage key scoped to one organization.
 * Keys use a random suffix — never the upload filename — so objects are not
 * guessable across companies.
 */
export function buildProductImageObjectKey(organizationId: OrganizationId): string {
  return `${organizationId}/${PRODUCT_IMAGE_SEGMENT}/${newUuid()}`;
}
