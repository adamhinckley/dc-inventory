import { describe, expect, it } from "vitest";
import { canManageOrganizations } from "./staff-organizations-manage";

describe("canManageOrganizations", () => {
  it("allows DEFAULT platform admins only", () => {
    expect(canManageOrganizations(["admin"], "DEFAULT")).toBe(true);
    expect(canManageOrganizations(["purchasing"], "DEFAULT")).toBe(false);
    expect(canManageOrganizations(["admin"], "660e8400-e29b-41d4-a716-446655440099")).toBe(
      false,
    );
  });
});
