import {
  OrganizationId,
  PlatformUserId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryOrganizationRepository } from "../src/adapters/in-memory-organization-repository.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemoryPlatformUserRepository } from "../src/adapters/in-memory-platform-user-repository.js";
import { InMemorySessionStore } from "../src/adapters/in-memory-session-store.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { LoginPlatformUseCase } from "../src/application/login-platform.js";
import { LoginStaffUseCase } from "../src/application/login-staff.js";
import { ResolvePlatformSessionUseCase } from "../src/application/resolve-session.js";
import { canStaffPerform } from "../src/application/staff-action-policy.js";
import { testStaffUser } from "./support/fixtures.js";

const PLATFORM_ID = PlatformUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");

describe("Platform user", () => {
  it("logs in without organizationSlug and resolves a platform session with null organizationId", async () => {
    const clock = new InMemoryClock(new Date("2026-09-12T12:00:00.000Z"));
    const passwords = new InMemoryPasswordHasher();
    const platformUsers = new InMemoryPlatformUserRepository();
    const sessions = new InMemorySessionStore();
    await platformUsers.save({
      id: PLATFORM_ID,
      displayName: "Adam Platform",
      email: "adam@local.test",
      passwordHash: await passwords.hash("platform-secret"),
    });

    const login = await new LoginPlatformUseCase(
      platformUsers,
      sessions,
      passwords,
      clock,
    ).execute({ email: "adam@local.test", password: "platform-secret" });
    expect(login.ok).toBe(true);
    if (!login.ok) {
      return;
    }

    const resolved = await new ResolvePlatformSessionUseCase(
      sessions,
      platformUsers,
      clock,
    ).execute(login.sessionId);
    expect(resolved).toEqual({
      ok: true,
      platformUserId: PLATFORM_ID,
      email: "adam@local.test",
    });

    const stored = await sessions.findById(login.sessionId);
    expect(stored?.audience).toBe("platform");
    expect(stored?.organizationId).toBeNull();
    expect(stored?.platformUserId).toBe(PLATFORM_ID);
  });

  it("does not grant organizations_manage to DEFAULT staff admin", () => {
    expect(
      canStaffPerform(["admin"], "organizations_manage", {
        organizationId: OrganizationId.DEFAULT,
      }),
    ).toBe(false);
  });

  it("keeps Platform and Staff emails disjoint at login", async () => {
    const clock = new InMemoryClock(new Date("2026-09-12T12:00:00.000Z"));
    const passwords = new InMemoryPasswordHasher();
    const organizations = new InMemoryOrganizationRepository();
    const staffUsers = new InMemoryStaffUserRepository();
    const platformUsers = new InMemoryPlatformUserRepository();
    const sessions = new InMemorySessionStore();
    await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme" });
    await platformUsers.save({
      id: PLATFORM_ID,
      displayName: "Adam Platform",
      email: "adam@local.test",
      passwordHash: await passwords.hash("platform-secret"),
    });
    await staffUsers.save(
      testStaffUser({
        id: STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "staff@local.test",
        passwordHash: await passwords.hash("staff-secret"),
        roles: ["admin"],
      }),
    );

    const staffLogin = await new LoginStaffUseCase(
      organizations,
      staffUsers,
      sessions,
      passwords,
      clock,
    ).execute({
      organizationSlug: "acme",
      email: "adam@local.test",
      password: "platform-secret",
    });
    expect(staffLogin.ok).toBe(false);

    const platformLogin = await new LoginPlatformUseCase(
      platformUsers,
      sessions,
      passwords,
      clock,
    ).execute({ email: "staff@local.test", password: "staff-secret" });
    expect(platformLogin.ok).toBe(false);
  });
});
