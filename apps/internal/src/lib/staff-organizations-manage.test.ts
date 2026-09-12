import { describe, expect, it } from "vitest";
import { isPlatformSession } from "./staff-organizations-manage";

describe("isPlatformSession", () => {
  it("returns true only when the internal session audience is platform", () => {
    expect(isPlatformSession(undefined)).toBe(false);
    expect(
      isPlatformSession({
        audience: "staff",
        staffUserId: "550e8400-e29b-41d4-a716-446655440001",
        email: "staff@local.test",
        displayName: "Test Staff",
        organizationId: "00000000-0000-0000-0000-000000000000",
        roles: ["admin"],
      }),
    ).toBe(false);
    expect(
      isPlatformSession({
        audience: "platform",
        platformUserId: "550e8400-e29b-41d4-a716-446655440010",
        email: "adam@local.test",
        displayName: "Adam Platform",
      }),
    ).toBe(true);
  });
});
