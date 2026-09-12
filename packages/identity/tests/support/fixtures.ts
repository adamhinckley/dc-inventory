import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { OpsUser } from "../../src/domain/ops-user.js";
import type { Organization } from "../../src/domain/organization.js";
import type { StaffUser } from "../../src/domain/staff-user.js";
import type { WholesaleUser } from "../../src/domain/wholesale-user.js";

export const TEST_ORG_NAME = "Acme Wholesale";
export const TEST_BETA_ORG_NAME = "Beta Wholesale";
export const TEST_STAFF_DISPLAY_NAME = "Test Staff";
export const TEST_WHOLESALE_DISPLAY_NAME = "Test Wholesale User";
export const TEST_OPS_DISPLAY_NAME = "Test Ops User";

export function testOrganization(input: {
  id: OrganizationId;
  slug: string;
  name?: string;
}): Organization {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name ?? TEST_ORG_NAME,
  };
}

export function testStaffUser(user: Omit<StaffUser, "displayName"> & { displayName?: string }): StaffUser {
  return {
    ...user,
    displayName: user.displayName ?? TEST_STAFF_DISPLAY_NAME,
  };
}

export function testWholesaleUser(
  user: Omit<WholesaleUser, "displayName"> & { displayName?: string },
): WholesaleUser {
  return {
    ...user,
    displayName: user.displayName ?? TEST_WHOLESALE_DISPLAY_NAME,
  };
}

export function testOpsUser(user: Omit<OpsUser, "displayName"> & { displayName?: string }): OpsUser {
  return {
    ...user,
    displayName: user.displayName ?? TEST_OPS_DISPLAY_NAME,
  };
}
