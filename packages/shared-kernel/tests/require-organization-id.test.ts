import { OrganizationId } from "../src/ids.js";
import { requireOrganizationId } from "../src/require-organization-id.js";
import { describe, expect, it } from "vitest";

describe("requireOrganizationId", () => {
  it("returns the organization id when present", () => {
    expect(requireOrganizationId(OrganizationId.DEFAULT)).toBe(OrganizationId.DEFAULT);
  });

  it("throws MissingOrganizationContextError when undefined", () => {
    expect(() => requireOrganizationId(undefined)).toThrow("Missing organization context");
  });
});
