import {
  InMemoryEmailSender,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  type IEmailSender,
} from "@dc-inventory/identity";
import { testStaffUser } from "@dc-inventory/identity/test-fixtures";
import {
  InMemoryLicensingStore,
  type ILicensingTenantProvisioner,
} from "@dc-inventory/licensing";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryDatabase } from "../in-memory-database.js";
import { buildApp } from "../../app.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";

const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

class FailingEmailSender implements IEmailSender {
  readonly sent = [];

  async send(message: Parameters<IEmailSender["send"]>[0]): Promise<void> {
    this.sent.push(message);
    throw new Error("delivery failed");
  }
}

class FailingLicensingProvisioner implements ILicensingTenantProvisioner {
  async ensureEmptyTenant(): Promise<void> {
    throw new Error("licensing twin failed");
  }
}

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startOrganizationsApp(
  overrides: {
    emailSender?: IEmailSender;
    licensingProvisioner?: ILicensingTenantProvisioner;
  } = {},
) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const emailSender = overrides.emailSender ?? new InMemoryEmailSender();
  const licensingStore = new InMemoryLicensingStore();

  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
  await organizations.save({ id: BETA_ORG, slug: "beta", name: "Beta Wholesale" });

  const platformAdminId = StaffUserId.parse("10000000-0000-4000-8000-000000000001");
  const platformPurchasingId = StaffUserId.parse("10000000-0000-4000-8000-000000000003");
  const betaAdminId = StaffUserId.parse("10000000-0000-4000-8000-000000000002");

  await staffUsers.save(
    testStaffUser({
      id: platformAdminId,
      organizationId: OrganizationId.DEFAULT,
      email: "platform-admin@local.test",
      passwordHash: await passwords.hash("staff-secret"),
      roles: ["admin"],
    }),
  );
  await staffUsers.save(
    testStaffUser({
      id: platformPurchasingId,
      organizationId: OrganizationId.DEFAULT,
      email: "platform-purchasing@local.test",
      passwordHash: await passwords.hash("staff-secret"),
      roles: ["purchasing"],
    }),
  );
  await staffUsers.save(
    testStaffUser({
      id: betaAdminId,
      organizationId: BETA_ORG,
      email: "beta-admin@local.test",
      passwordHash: await passwords.hash("staff-secret"),
      roles: ["admin"],
    }),
  );

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    organizationRepo: organizations,
    staffUsers,
    sessions,
    passwords,
    emailSender,
    licensingStore,
    licensingProvisioner: overrides.licensingProvisioner,
  });
  apps.push(app);

  async function cookie(email: string, organizationSlug: string): Promise<string> {
    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: { organizationSlug, email, password: "staff-secret" },
    });
    expect(login.statusCode).toBe(200);
    const value = login.cookies.find((item) => item.name === STAFF_SESSION_COOKIE)?.value;
    if (value === undefined) {
      throw new Error("expected staff session cookie");
    }
    return value;
  }

  return { app, cookie, emailSender, licensingStore, organizations, staffUsers };
}

const createPayload = {
  name: "Harbor Wholesale",
  slug: "harbor-wholesale",
  staffDisplayName: "Harbor Owner",
  staffEmail: "owner@harbor.test",
};

describe("create internal organization", () => {
  it("allows DEFAULT platform admins and provisions licensing twin + invite", async () => {
    const { app, cookie, emailSender, licensingStore, organizations } =
      await startOrganizationsApp();
    const session = await cookie("platform-admin@local.test", "acme");

    const created = await app.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: session },
      payload: createPayload,
    });

    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body).toMatchObject({
      slug: "harbor-wholesale",
      inviteSentTo: "owner@harbor.test",
    });
    expect(body.organizationId).not.toBe(OrganizationId.DEFAULT);

    const org = await organizations.findBySlug("harbor-wholesale");
    expect(org?.name).toBe("Harbor Wholesale");

    const subscription = await licensingStore.getLatestSubscription(
      OrganizationId.parse(body.organizationId),
    );
    expect(subscription).toMatchObject({ plan: "twin", status: "trialing" });

    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0]).toMatchObject({ to: "owner@harbor.test" });
  });

  it("forbids tenant admins outside DEFAULT", async () => {
    const { app, cookie } = await startOrganizationsApp();
    const session = await cookie("beta-admin@local.test", "beta");

    const forbidden = await app.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: session },
      payload: {
        name: "Gamma Wholesale",
        slug: "gamma",
        staffDisplayName: "Gamma Owner",
        staffEmail: "owner@gamma.test",
      },
    });

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "forbidden" });
  });

  it("forbids DEFAULT purchasing staff", async () => {
    const { app, cookie } = await startOrganizationsApp();
    const session = await cookie("platform-purchasing@local.test", "acme");

    const forbidden = await app.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: session },
      payload: createPayload,
    });

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "forbidden" });
  });

  it("rejects duplicate slug", async () => {
    const { app, cookie } = await startOrganizationsApp();
    const session = await cookie("platform-admin@local.test", "acme");

    const duplicate = await app.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: session },
      payload: {
        name: "Second Beta",
        slug: "beta",
        staffDisplayName: "Beta Owner",
        staffEmail: "other@beta.test",
      },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "slug_taken" });
  });

  it("rolls back when invite delivery fails so retry is not slug_taken", async () => {
    const failingEmail = new FailingEmailSender();
    const { app, cookie, organizations } = await startOrganizationsApp({
      emailSender: failingEmail,
    });
    const session = await cookie("platform-admin@local.test", "acme");

    const failed = await app.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: session },
      payload: createPayload,
    });

    expect(failed.statusCode).toBe(502);
    expect(failed.json()).toEqual({ error: "invite_failed" });
    expect(await organizations.findBySlug("harbor-wholesale")).toBeNull();
    expect(failingEmail.sent).toHaveLength(1);

    const retryHarness = await startOrganizationsApp();
    const retrySession = await retryHarness.cookie("platform-admin@local.test", "acme");

    const created = await retryHarness.app.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: retrySession },
      payload: createPayload,
    });

    expect(created.statusCode).toBe(201);
    expect(await retryHarness.organizations.findBySlug("harbor-wholesale")).not.toBeNull();
    expect(retryHarness.emailSender.sent).toHaveLength(1);
  });

  it("rolls back registration when licensing twin provisioning fails", async () => {
    const { app, cookie, organizations, licensingStore } = await startOrganizationsApp({
      licensingProvisioner: new FailingLicensingProvisioner(),
    });
    const session = await cookie("platform-admin@local.test", "acme");

    const failed = await app.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: session },
      payload: createPayload,
    });

    expect(failed.statusCode).toBe(503);
    expect(failed.json()).toEqual({ error: "licensing_twin_failed" });
    expect(await organizations.findBySlug("harbor-wholesale")).toBeNull();

    const { app: retryApp, cookie: retryCookie, organizations: retryOrgs, licensingStore: retryLicensing } =
      await startOrganizationsApp();
    const retrySession = await retryCookie("platform-admin@local.test", "acme");

    const created = await retryApp.inject({
      method: "POST",
      url: "/internal/organizations",
      cookies: { [STAFF_SESSION_COOKIE]: retrySession },
      payload: createPayload,
    });

    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(await retryOrgs.findBySlug("harbor-wholesale")).not.toBeNull();
    expect(
      await retryLicensing.getLatestSubscription(OrganizationId.parse(body.organizationId)),
    ).toMatchObject({ plan: "twin", status: "trialing" });
  });
});
