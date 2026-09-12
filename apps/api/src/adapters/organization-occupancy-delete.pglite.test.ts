import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { createOrganizationOccupancyHarness } from "./support/organization-occupancy-pglite.js";

const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const BETA_STAFF_ID = StaffUserId.parse("10000000-0000-4000-8000-000000000002");

describe("organization occupancy + delete (PGlite)", () => {
  it("refuses busy orgs and deletes empty org staff + sessions", async () => {
    const { client, organizations, staffUsers, deleteWithOccupancy } =
      await createOrganizationOccupancyHarness();

    await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
    await organizations.save({ id: BETA_ORG, slug: "beta", name: "Beta Wholesale" });
    await staffUsers.save({
      id: BETA_STAFF_ID,
      organizationId: BETA_ORG,
      displayName: "Beta Admin",
      email: "beta-admin@local.test",
      passwordHash: "hash",
      roles: ["admin"],
    });

    await client.exec(`
      INSERT INTO catalog.products (id, organization_id, sku, name, uom, member_price_cents)
      VALUES ('da209000-0000-4000-8000-000000000101', '${BETA_ORG}', 'SKU-1', 'Widget', 'ea', 100);
    `);

    expect(await deleteWithOccupancy.execute(BETA_ORG)).toEqual({
      ok: false,
      reason: "org_not_empty",
    });
    expect(await organizations.findById(BETA_ORG)).not.toBeNull();

    await client.exec(`DELETE FROM catalog.products WHERE organization_id = '${BETA_ORG}';`);
    expect(await deleteWithOccupancy.execute(BETA_ORG)).toEqual({ ok: true });
    expect(await organizations.findById(BETA_ORG)).toBeNull();
    expect(await staffUsers.findById(BETA_STAFF_ID)).toBeNull();
  });
});
