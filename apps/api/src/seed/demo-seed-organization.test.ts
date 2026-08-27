import { describe, expect, it } from "vitest";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { DEMO_SEED_ORGANIZATION_ID } from "./demo-seed-organization.js";

describe("DEMO_SEED_ORGANIZATION_ID", () => {
  it("is OrganizationId.DEFAULT — demo seed never writes a second org", () => {
    expect(DEMO_SEED_ORGANIZATION_ID).toBe(OrganizationId.DEFAULT);
    expect(DEMO_SEED_ORGANIZATION_ID).toBe("DEFAULT");
  });
});
