import {
  InMemoryOrganizationRepository,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DeleteOrganizationUseCase } from "../src/application/delete-organization.js";
import { testStaffUser } from "./support/fixtures.js";

const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const BETA_STAFF_ID = StaffUserId.parse("10000000-0000-4000-8000-000000000002");

describe("DeleteOrganization (in-memory)", () => {
  it("refuses DEFAULT and removes staff plus sessions for an empty org", async () => {
    const organizations = new InMemoryOrganizationRepository();
    const staffUsers = new InMemoryStaffUserRepository();
    const sessions = new InMemorySessionStore();
    const deleteOrganization = new DeleteOrganizationUseCase(
      organizations,
      staffUsers,
      sessions,
    );

    await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
    await organizations.save({ id: BETA_ORG, slug: "beta", name: "Beta Wholesale" });
    await staffUsers.save(
      testStaffUser({
        id: BETA_STAFF_ID,
        organizationId: BETA_ORG,
        email: "beta-admin@local.test",
        passwordHash: "hash",
        roles: ["admin"],
      }),
    );
    const session = await sessions.create({
      audience: "staff",
      organizationId: BETA_ORG,
      staffUserId: BETA_STAFF_ID,
      platformUserId: null,
      wholesaleUserId: null,
      opsUserId: null,
      customerId: null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    });

    expect(await deleteOrganization.execute(OrganizationId.DEFAULT)).toEqual({
      ok: false,
      reason: "default_organization",
    });

    const deleted = await deleteOrganization.execute(BETA_ORG);
    expect(deleted).toEqual({ ok: true });
    expect(await organizations.findById(BETA_ORG)).toBeNull();
    expect(await staffUsers.findById(BETA_STAFF_ID)).toBeNull();
    expect(await sessions.findById(session.id)).toBeNull();
  });
});
