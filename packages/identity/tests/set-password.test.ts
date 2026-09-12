import {
  CustomerId,
  OrganizationId,
  PlatformUserId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemoryPlatformUserRepository } from "../src/adapters/in-memory-platform-user-repository.js";
import { InMemorySetPasswordTokenStore } from "../src/adapters/in-memory-set-password-token-store.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import { SetPasswordUseCase } from "../src/application/set-password.js";
import { SET_PASSWORD_TOKEN_TTL_MS } from "../src/domain/set-password-token.js";
import { testStaffUser, testWholesaleUser } from "./support/fixtures.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001");
const WHOLESALE_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002");
const NOW = new Date("2026-09-12T12:00:00.000Z");

function harness() {
  const clock = new InMemoryClock(NOW);
  const passwords = new InMemoryPasswordHasher();
  const tokens = new InMemorySetPasswordTokenStore();
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const platformUsers = new InMemoryPlatformUserRepository();
  const setPassword = new SetPasswordUseCase(
    tokens,
    staffUsers,
    wholesaleUsers,
    platformUsers,
    passwords,
    clock,
  );
  return { clock, passwords, tokens, staffUsers, wholesaleUsers, platformUsers, setPassword };
}

describe("SetPasswordUseCase", () => {
  it("sets a staff password from a valid staff token", async () => {
    const h = harness();
    await h.staffUsers.save(
      testStaffUser({
        id: STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "staff@local.test",
        roles: ["admin"],
        passwordHash: await h.passwords.hash("pending-secret"),
      }),
    );
    const { rawToken } = await h.tokens.mint({
      audience: "staff",
      userId: STAFF_ID,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });

    const result = await h.setPassword.execute({
      token: rawToken,
      password: "NewPass1",
      audience: "staff",
    });

    expect(result).toEqual({ ok: true });
    const saved = await h.staffUsers.findById(STAFF_ID);
    expect(await h.passwords.verify("NewPass1", saved!.passwordHash)).toBe(true);
    expect(
      await h.setPassword.execute({
        token: rawToken,
        password: "AnotherPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("sets a wholesale password from a valid wholesale token", async () => {
    const h = harness();
    await h.wholesaleUsers.save(
      testWholesaleUser({
        id: WHOLESALE_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "wholesale@local.test",
        customerId: CustomerId.parse("33333333-3333-4333-8333-333333333333"),
        passwordHash: await h.passwords.hash("pending-secret"),
      }),
    );
    const { rawToken } = await h.tokens.mint({
      audience: "wholesale",
      userId: WHOLESALE_ID,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });

    const result = await h.setPassword.execute({
      token: rawToken,
      password: "ShopPass1",
      audience: "wholesale",
    });

    expect(result).toEqual({ ok: true });
    const saved = await h.wholesaleUsers.findById(WHOLESALE_ID);
    expect(await h.passwords.verify("ShopPass1", saved!.passwordHash)).toBe(true);
  });

  it("rejects reused, expired, unknown, and wrong-audience tokens with the same failure", async () => {
    const h = harness();
    await h.staffUsers.save(
      testStaffUser({
        id: STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "staff@local.test",
        roles: ["admin"],
        passwordHash: await h.passwords.hash("pending-secret"),
      }),
    );
    const { rawToken } = await h.tokens.mint({
      audience: "staff",
      userId: STAFF_ID,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });

    expect(
      await h.setPassword.execute({
        token: rawToken,
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: true });

    expect(
      await h.setPassword.execute({
        token: rawToken,
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    const expired = await h.tokens.mint({
      audience: "staff",
      userId: STAFF_ID,
      expiresAt: new Date(NOW.getTime() - 1_000),
    });
    expect(
      await h.setPassword.execute({
        token: expired.rawToken,
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    const wholesaleToken = await h.tokens.mint({
      audience: "wholesale",
      userId: WHOLESALE_ID,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });
    expect(
      await h.setPassword.execute({
        token: wholesaleToken.rawToken,
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.setPassword.execute({
        token: "not-a-real-token",
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not consume the token when the user row is missing", async () => {
    const h = harness();
    const missingUserId = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440099");
    const { rawToken } = await h.tokens.mint({
      audience: "staff",
      userId: missingUserId,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });

    expect(
      await h.setPassword.execute({
        token: rawToken,
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    await h.staffUsers.save(
      testStaffUser({
        id: missingUserId,
        organizationId: OrganizationId.DEFAULT,
        email: "late.staff@local.test",
        roles: ["admin"],
        passwordHash: await h.passwords.hash("pending-secret"),
      }),
    );

    expect(
      await h.setPassword.execute({
        token: rawToken,
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: true });
  });

  it("returns password policy violations without consuming the token", async () => {
    const h = harness();
    await h.staffUsers.save(
      testStaffUser({
        id: STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "staff@local.test",
        roles: ["admin"],
        passwordHash: await h.passwords.hash("pending-secret"),
      }),
    );
    const { rawToken } = await h.tokens.mint({
      audience: "staff",
      userId: STAFF_ID,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });

    expect(
      await h.setPassword.execute({
        token: rawToken,
        password: "short",
        audience: "staff",
      }),
    ).toEqual({ ok: false, reason: "password_policy", violation: "too_short" });

    expect(
      await h.setPassword.execute({
        token: rawToken,
        password: "ValidPass1",
        audience: "staff",
      }),
    ).toEqual({ ok: true });
  });

  it("sets a platform password from a valid platform token", async () => {
    const h = harness();
    const platformId = PlatformUserId.parse("550e8400-e29b-41d4-a716-446655440099");
    await h.platformUsers.save({
      id: platformId,
      displayName: "Adam Platform",
      email: "adam@local.test",
      passwordHash: await h.passwords.hash("pending-secret"),
    });
    const { rawToken } = await h.tokens.mint({
      audience: "platform",
      userId: platformId,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });

    const result = await h.setPassword.execute({
      token: rawToken,
      password: "ValidPass1",
      audience: "platform",
    });

    expect(result).toEqual({ ok: true });
    const saved = await h.platformUsers.findById(platformId);
    expect(await h.passwords.verify("ValidPass1", saved!.passwordHash)).toBe(true);
  });

  it("invalidates unused tokens when the user is deleted", async () => {
    const h = harness();
    const { rawToken } = await h.tokens.mint({
      audience: "wholesale",
      userId: WHOLESALE_ID,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });
    const other = await h.tokens.mint({
      audience: "staff",
      userId: STAFF_ID,
      expiresAt: new Date(NOW.getTime() + SET_PASSWORD_TOKEN_TTL_MS),
    });

    await h.tokens.deleteByUserId(WHOLESALE_ID);

    expect(
      await h.tokens.findValid({
        rawToken,
        expectedAudience: "wholesale",
        now: NOW,
      }),
    ).toBeNull();
    expect(
      await h.tokens.findValid({
        rawToken: other.rawToken,
        expectedAudience: "staff",
        now: NOW,
      }),
    ).toEqual({ userId: STAFF_ID, audience: "staff" });
  });
});
