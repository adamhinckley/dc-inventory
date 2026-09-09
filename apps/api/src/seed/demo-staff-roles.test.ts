import { describe, expect, it } from "vitest";
import { withDemoStaffRoles } from "./demo-staff-roles.js";

describe("withDemoStaffRoles", () => {
  it("adds accounting to existing admin-only demo staff", () => {
    expect(withDemoStaffRoles(["admin"])).toEqual(["admin", "accounting"]);
  });

  it("defaults to admin and accounting when no roles exist yet", () => {
    expect(withDemoStaffRoles(undefined)).toEqual(["admin", "accounting"]);
  });
});
