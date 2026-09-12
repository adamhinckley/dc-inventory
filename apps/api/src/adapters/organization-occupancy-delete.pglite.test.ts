import { OrganizationId, SessionId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { createOrganizationOccupancyHarness } from "./support/organization-occupancy-pglite.js";

const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const BETA_STAFF_ID = StaffUserId.parse("10000000-0000-4000-8000-000000000002");
const BETA_SESSION_ID = SessionId.parse("20000000-0000-4000-8000-000000000099");

describe("organization occupancy + delete (PGlite)", () => {
  it("refuses busy orgs and deletes empty org staff + sessions", async () => {
    const { client, organizations, staffUsers, sessions, deleteWithOccupancy } =
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
      INSERT INTO identity.sessions (
        id,
        actor_type,
        actor_id,
        organization_id,
        staff_user_id
      ) VALUES (
        '${BETA_SESSION_ID}',
        'staff',
        '${BETA_STAFF_ID}',
        '${BETA_ORG}',
        NULL
      );
    `);
    expect(await sessions.findById(BETA_SESSION_ID)).not.toBeNull();

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
    expect(await sessions.findById(BETA_SESSION_ID)).toBeNull();
  });

  it("treats categories and locations as occupancy", async () => {
    const { client, organizations, deleteWithOccupancy } =
      await createOrganizationOccupancyHarness();

    await organizations.save({ id: BETA_ORG, slug: "beta", name: "Beta Wholesale" });

    await client.exec(`
      INSERT INTO catalog.categories (id, organization_id, name)
      VALUES ('da209000-0000-4000-8000-000000000201', '${BETA_ORG}', 'Hardware');
    `);
    expect(await deleteWithOccupancy.execute(BETA_ORG)).toEqual({
      ok: false,
      reason: "org_not_empty",
    });

    await client.exec(`DELETE FROM catalog.categories WHERE organization_id = '${BETA_ORG}';`);
    await client.exec(`
      INSERT INTO inventory.locations (id, organization_id, code)
      VALUES ('da209000-0000-4000-8000-000000000202', '${BETA_ORG}', 'MAIN');
    `);
    expect(await deleteWithOccupancy.execute(BETA_ORG)).toEqual({
      ok: false,
      reason: "org_not_empty",
    });
  });
});
