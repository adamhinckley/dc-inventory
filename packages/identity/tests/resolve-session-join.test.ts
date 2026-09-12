import {
  CustomerId,
  OrganizationId,
  SessionId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS } from "../src/adapters/active-wholesale-login-account-status.js";
import { InMemoryOrganizationRepository } from "../src/adapters/in-memory-organization-repository.js";
import { InMemoryPlatformUserRepository } from "../src/adapters/in-memory-platform-user-repository.js";
import { InMemoryOpsUserRepository } from "../src/adapters/in-memory-ops-user-repository.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemorySessionStore } from "../src/adapters/in-memory-session-store.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import { LoginOpsUseCase } from "../src/application/login-ops.js";
import { LoginStaffUseCase } from "../src/application/login-staff.js";
import { LoginWholesaleUseCase } from "../src/application/login-wholesale.js";
import {
  ResolveOpsSessionUseCase,
  ResolveStaffSessionUseCase,
  ResolveWholesaleSessionUseCase,
} from "../src/application/resolve-session.js";
import { OpsUserId } from "../src/domain/ops-user.js";
import { SESSION_TOUCH_DEBOUNCE_MS } from "../src/domain/session.js";
import { JoinBackedSessionStore } from "./join-backed-session-store.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001");
const WHOLESALE_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002");
const OPERATOR_ID = OpsUserId.parse("550e8400-e29b-41d4-a716-446655440005");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440003");
const BETA_ORG_ID = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const ACME_SLUG = "acme";

function harness(at = new Date("2026-08-23T02:00:00.000Z")) {
  const clock = new InMemoryClock(at);
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const opsUsers = new InMemoryOpsUserRepository();
  const platformUsers = new InMemoryPlatformUserRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const joinSessions = new JoinBackedSessionStore(
    sessions,
    staffUsers,
    wholesaleUsers,
    opsUsers,
  );
  return {
    clock,
    passwords,
    organizations,
    opsUsers,
    platformUsers,
    staffUsers,
    wholesaleUsers,
    sessions,
    joinSessions,
    loginOps: new LoginOpsUseCase(organizations, opsUsers, sessions, passwords, clock),
    loginStaff: new LoginStaffUseCase(
      organizations,
      staffUsers,
      platformUsers,
      sessions,
      passwords,
      clock,
    ),
    loginWholesale: new LoginWholesaleUseCase(
      organizations,
      wholesaleUsers,
      staffUsers,
      sessions,
      passwords,
      clock,
      ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS,
    ),
    resolveStaff: new ResolveStaffSessionUseCase(joinSessions, staffUsers, clock),
    resolveWholesale: new ResolveWholesaleSessionUseCase(
      joinSessions,
      wholesaleUsers,
      staffUsers,
      clock,
    ),
    resolveOps: new ResolveOpsSessionUseCase(joinSessions, opsUsers, clock),
  };
}

async function seedAcmeOrg(h: ReturnType<typeof harness>) {
  await h.organizations.save({ id: OrganizationId.DEFAULT, slug: ACME_SLUG, name: "Acme Wholesale" });
}

describe("Resolve session joined reads", () => {
  it("deletes orphaned staff sessions on the join path when the user is missing", async () => {
    const h = harness();
    await seedAcmeOrg(h);
    await h.staffUsers.save({
      id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Staff",
      email: "staff@local.test",
      passwordHash: await h.passwords.hash("staff-secret"),
      roles: ["admin"],
    });
    const login = await h.loginStaff.execute({
      organizationSlug: ACME_SLUG,
      email: "staff@local.test",
      password: "staff-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }
    const sessionId = SessionId.parse(login.sessionId);
    await h.staffUsers.save({
      id: STAFF_ID,
      organizationId: BETA_ORG_ID,
      displayName: "Test Staff",
      email: "staff@local.test",
      passwordHash: await h.passwords.hash("staff-secret"),
      roles: ["admin"],
    });
    await h.sessions.touch(sessionId, new Date("2026-08-23T01:00:00.000Z"));

    const result = await h.resolveStaff.execute(login.sessionId);
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(await h.sessions.findById(sessionId)).toBeNull();
  });

  it("returns wrong_audience on the staff join path without deleting another audience session", async () => {
    const h = harness();
    await seedAcmeOrg(h);
    await h.wholesaleUsers.save({
      id: WHOLESALE_ID,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Wholesale User",
      email: "buyer@local.test",
      passwordHash: await h.passwords.hash("buyer-secret"),
      customerId: CUSTOMER_ID,
    });
    const login = await h.loginWholesale.execute({
      organizationSlug: ACME_SLUG,
      email: "buyer@local.test",
      password: "buyer-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }
    const sessionId = SessionId.parse(login.sessionId);

    const result = await h.resolveStaff.execute(login.sessionId);
    expect(result).toEqual({ ok: false, reason: "wrong_audience" });
    expect(await h.sessions.findById(sessionId)).not.toBeNull();
  });

  it("deletes orphaned wholesale buyer sessions on the join path when the user is missing", async () => {
    const h = harness();
    await seedAcmeOrg(h);
    await h.wholesaleUsers.save({
      id: WHOLESALE_ID,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Wholesale User",
      email: "buyer@local.test",
      passwordHash: await h.passwords.hash("buyer-secret"),
      customerId: CUSTOMER_ID,
    });
    const login = await h.loginWholesale.execute({
      organizationSlug: ACME_SLUG,
      email: "buyer@local.test",
      password: "buyer-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }
    const sessionId = SessionId.parse(login.sessionId);
    await h.wholesaleUsers.save({
      id: WHOLESALE_ID,
      organizationId: BETA_ORG_ID,
      displayName: "Test Wholesale User",
      email: "buyer@local.test",
      passwordHash: await h.passwords.hash("buyer-secret"),
      customerId: CUSTOMER_ID,
    });

    const result = await h.resolveWholesale.execute(login.sessionId);
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(await h.sessions.findById(sessionId)).toBeNull();
  });

  it("deletes orphaned ops sessions on the join path when tenant organization mismatches", async () => {
    const h = harness();
    await seedAcmeOrg(h);
    await h.opsUsers.save({
      id: OPERATOR_ID,
      tenantId: OrganizationId.DEFAULT,
      displayName: "Test Ops User",
      email: "operator@local.test",
      passwordHash: await h.passwords.hash("operator-secret"),
      kind: "operator",
    });
    const login = await h.loginOps.execute({
      organizationSlug: ACME_SLUG,
      email: "operator@local.test",
      password: "operator-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }
    const sessionId = SessionId.parse(login.sessionId);
    await h.opsUsers.save({
      id: OPERATOR_ID,
      tenantId: BETA_ORG_ID,
      displayName: "Test Ops User",
      email: "operator@local.test",
      passwordHash: await h.passwords.hash("operator-secret"),
      kind: "operator",
    });

    const result = await h.resolveOps.execute(login.sessionId);
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(await h.sessions.findById(sessionId)).toBeNull();
  });

  it("resolves wholesale buyer sessions with one joined read", async () => {
    const h = harness();
    await seedAcmeOrg(h);
    await h.wholesaleUsers.save({
      id: WHOLESALE_ID,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Wholesale User",
      email: "buyer@local.test",
      passwordHash: await h.passwords.hash("buyer-secret"),
      customerId: CUSTOMER_ID,
    });
    const login = await h.loginWholesale.execute({
      organizationSlug: ACME_SLUG,
      email: "buyer@local.test",
      password: "buyer-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }

    const findWholesaleResolved = vi.spyOn(h.joinSessions, "findWholesaleResolved");
    const joinFindById = vi.spyOn(h.joinSessions, "findById");

    const result = await h.resolveWholesale.execute(login.sessionId);
    expect(result).toMatchObject({ ok: true, wholesaleUserId: WHOLESALE_ID });
    expect(findWholesaleResolved).toHaveBeenCalledTimes(1);
    expect(joinFindById).not.toHaveBeenCalled();
  });

  it("debounces lastSeen on the wholesale and ops join paths", async () => {
    const h = harness();
    await seedAcmeOrg(h);
    await h.wholesaleUsers.save({
      id: WHOLESALE_ID,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Wholesale User",
      email: "buyer@local.test",
      passwordHash: await h.passwords.hash("buyer-secret"),
      customerId: CUSTOMER_ID,
    });
    await h.opsUsers.save({
      id: OPERATOR_ID,
      tenantId: OrganizationId.DEFAULT,
      displayName: "Test Ops User",
      email: "operator@local.test",
      passwordHash: await h.passwords.hash("operator-secret"),
      kind: "operator",
    });

    const wholesaleLogin = await h.loginWholesale.execute({
      organizationSlug: ACME_SLUG,
      email: "buyer@local.test",
      password: "buyer-secret",
    });
    const opsLogin = await h.loginOps.execute({
      organizationSlug: ACME_SLUG,
      email: "operator@local.test",
      password: "operator-secret",
    });
    if (!wholesaleLogin.ok || !opsLogin.ok) {
      throw new Error("expected login");
    }

    const wholesaleSessionId = SessionId.parse(wholesaleLogin.sessionId);
    const opsSessionId = SessionId.parse(opsLogin.sessionId);
    const wholesaleLastSeen = (await h.sessions.findById(wholesaleSessionId))?.lastSeenAt;
    const opsLastSeen = (await h.sessions.findById(opsSessionId))?.lastSeenAt;

    h.clock.advance(1000);
    expect(await h.resolveWholesale.execute(wholesaleLogin.sessionId)).toMatchObject({ ok: true });
    expect(await h.resolveOps.execute(opsLogin.sessionId)).toMatchObject({ ok: true });
    expect((await h.sessions.findById(wholesaleSessionId))?.lastSeenAt).toEqual(wholesaleLastSeen);
    expect((await h.sessions.findById(opsSessionId))?.lastSeenAt).toEqual(opsLastSeen);

    h.clock.advance(SESSION_TOUCH_DEBOUNCE_MS - 1000);
    expect(await h.resolveWholesale.execute(wholesaleLogin.sessionId)).toMatchObject({ ok: true });
    expect((await h.sessions.findById(wholesaleSessionId))?.lastSeenAt).toEqual(wholesaleLastSeen);

    h.clock.advance(1001);
    expect(await h.resolveWholesale.execute(wholesaleLogin.sessionId)).toMatchObject({ ok: true });
    expect(await h.resolveOps.execute(opsLogin.sessionId)).toMatchObject({ ok: true });
    expect((await h.sessions.findById(wholesaleSessionId))?.lastSeenAt?.getTime()).toBeGreaterThan(
      wholesaleLastSeen?.getTime() ?? 0,
    );
    expect((await h.sessions.findById(opsSessionId))?.lastSeenAt?.getTime()).toBeGreaterThan(
      opsLastSeen?.getTime() ?? 0,
    );
  });
});
