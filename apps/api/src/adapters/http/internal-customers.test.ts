import {
  InMemoryClock,
  InMemoryEmailSender,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  type IEmailSender,
  type StaffRole,
} from "@dc-inventory/identity";
import { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryCustomerOccupancyReadPort } from "../customer-occupancy-read-port.js";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";

const STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS = 1_000_000;

class FailingEmailSender implements IEmailSender {
  readonly sent: Parameters<IEmailSender["send"]>[0][] = [];

  async send(message: Parameters<IEmailSender["send"]>[0]): Promise<void> {
    this.sent.push(message);
    throw new Error("delivery failed");
  }
}

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startCustomersApp(
  options: {
    emailSender?: IEmailSender;
    customerOccupancy?: InMemoryCustomerOccupancyReadPort;
  } = {},
) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const emailSender = options.emailSender ?? new InMemoryEmailSender();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });

  for (const [index, role] of (
    ["admin", "purchasing"] as const
  ).entries()) {
    await staffUsers.save({
      id: StaffUserId.parse(`10000000-0000-4000-8000-00000000000${index}`),
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Staff",
      email: `${role}@local.test`,
      passwordHash: await passwords.hash("staff-secret"),
      roles: [role],
    });
  }

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-23T03:00:00.000Z")),
    staffUsers,
    wholesaleUsers: new InMemoryWholesaleUserRepository(),
    sessions,
    passwords,
    organizationRepo: organizations,
    emailSender,
    customerOccupancy: options.customerOccupancy,
  });
  apps.push(app);

  async function cookie(role: StaffRole): Promise<string> {
    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: "acme",
        email: `${role}@local.test`,
        password: "staff-secret",
      },
    });
    expect(login.statusCode).toBe(200);
    const value = login.cookies.find((item) => item.name === STAFF_SESSION_COOKIE)?.value;
    if (value === undefined) {
      throw new Error("expected staff session cookie");
    }
    return value;
  }

  return { app, cookie, emailSender };
}

describe("internal customers HTTP", () => {
  it("requires staff_session on customers list and CRUD", async () => {
    const { app, cookie } = await startCustomersApp();
    const missing = await app.inject({ method: "GET", url: "/internal/customers" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });

    const purchasing = await cookie("purchasing");
    const listed = await app.inject({
      method: "GET",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({ items: [], page: 1, pageSize: 25, total: 0 });
  });

  it("creates a customer, unique contact email, and exemption without object_key", async () => {
    const { app, cookie } = await startCustomersApp();
    const purchasing = await cookie("purchasing");

    const created = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        name: "Acme Wholesale",
        terms: "Net 30",
      },
    });
    expect(created.statusCode).toBe(201);
    const customer = created.json() as { id: string; name: string };
    expect(customer.name).toBe("Acme Wholesale");

    const contact = await app.inject({
      method: "POST",
      url: `/internal/customers/${customer.id}/contacts`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: { name: "Pat Buyer", email: "pat@acme.test" },
    });
    expect(contact.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: `/internal/customers/${customer.id}/contacts`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: { name: "Other", email: "pat@acme.test" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate_email" });

    const exemption = await app.inject({
      method: "POST",
      url: `/internal/customers/${customer.id}/exemption-certificates`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: { jurisdiction: "UT", status: "on_file" },
    });
    expect(exemption.statusCode).toBe(201);
    expect(exemption.json()).toMatchObject({
      jurisdiction: "UT",
      objectKey: null,
      entityUseCode: null,
    });
  });

  it("keeps ship-to list order when the default changes", async () => {
    const { app, cookie } = await startCustomersApp();
    const purchasing = await cookie("purchasing");

    const created = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        name: "Acme Wholesale",
        terms: "Net 30",
      },
    });
    expect(created.statusCode).toBe(201);
    const customerId = created.json().id as string;

    const main = await app.inject({
      method: "POST",
      url: `/internal/customers/${customerId}/ship-tos`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        line1: "123 Main St",
        city: "Ogden",
        region: "UT",
        postal: "84401",
        country: "US",
        isDefault: true,
      },
    });
    expect(main.statusCode).toBe(201);
    const mainId = main.json().id as string;

    const warehouse = await app.inject({
      method: "POST",
      url: `/internal/customers/${customerId}/ship-tos`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        line1: "100 Warehouse Rd",
        city: "Ogden",
        region: "UT",
        postal: "84401",
        country: "US",
        isDefault: false,
      },
    });
    expect(warehouse.statusCode).toBe(201);
    const warehouseId = warehouse.json().id as string;

    const before = await app.inject({
      method: "GET",
      url: `/internal/customers/${customerId}/ship-tos`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
    });
    expect(before.statusCode).toBe(200);
    const orderBefore = (before.json().items as Array<{ id: string }>).map((row) => row.id);
    expect(orderBefore).toContain(mainId);
    expect(orderBefore).toContain(warehouseId);

    const promoted = await app.inject({
      method: "PATCH",
      url: `/internal/customers/${customerId}/ship-tos/${warehouseId}`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: { isDefault: true },
    });
    expect(promoted.statusCode).toBe(200);
    expect(promoted.json()).toMatchObject({ id: warehouseId, isDefault: true });

    const after = await app.inject({
      method: "GET",
      url: `/internal/customers/${customerId}/ship-tos`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
    });
    expect(after.statusCode).toBe(200);
    const items = after.json().items as Array<{ id: string; isDefault: boolean }>;
    expect(items.map((row) => row.id)).toEqual(orderBefore);
    expect(items.find((row) => row.id === warehouseId)?.isDefault).toBe(true);
    expect(items.find((row) => row.id === mainId)?.isDefault).toBe(false);
    expect(items.filter((row) => row.isDefault)).toHaveLength(1);
  });
});

describe("internal customers staff-for-them wholesale invite", () => {
  it("allows admin to create customer with wholesale invite email", async () => {
    const { app, cookie, emailSender } = await startCustomersApp();
    const admin = await cookie("admin");

    const response = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Harbor Supply",
        terms: "Net 30",
        wholesaleEmail: "buyer@harbor.test",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "Harbor Supply",
      creditLimitCents: STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS,
    });
    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0]).toMatchObject({
      to: "buyer@harbor.test",
      subject: "You're invited to Acme Wholesale wholesale",
    });
    expect(emailSender.sent[0]?.text).toContain("/set-password?token=");
    expect(emailSender.sent[0]?.text).toContain("organization=acme");
    expect(emailSender.sent[0]?.text).toContain("email=buyer%40harbor.test");
    expect(emailSender.sent[0]?.text).toContain("name=Harbor+Supply");
  });

  it("defaults wholesale display name to customer name", async () => {
    const { app, cookie, emailSender } = await startCustomersApp();
    const admin = await cookie("admin");

    const response = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Summit Retail",
        terms: "Net 30",
        wholesaleEmail: "summit@buyer.test",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(emailSender.sent[0]?.text).toContain("Summit Retail");
  });

  it("rejects admin create without wholesale email", async () => {
    const { app, cookie, emailSender } = await startCustomersApp();
    const admin = await cookie("admin");

    const response = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Harbor Supply",
        terms: "Net 30",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid" });
    expect(emailSender.sent).toHaveLength(0);
  });

  it("allows purchasing to create header-only customers", async () => {
    const { app, cookie, emailSender } = await startCustomersApp();
    const purchasing = await cookie("purchasing");

    const response = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        name: "Purchasing Header Co",
        terms: "Net 30",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "Purchasing Header Co" });
    expect(emailSender.sent).toHaveLength(0);
  });

  it("rejects wholesale login fields from purchasing", async () => {
    const { app, cookie } = await startCustomersApp();
    const purchasing = await cookie("purchasing");

    const response = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        name: "Blocked Login Co",
        terms: "Net 30",
        wholesaleEmail: "blocked@buyer.test",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("rejects duplicate wholesale email", async () => {
    const { app, cookie } = await startCustomersApp();
    const admin = await cookie("admin");

    const first = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "First Customer",
        terms: "Net 30",
        wholesaleEmail: "shared@buyer.test",
      },
    });
    expect(first.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Second Customer",
        terms: "Net 30",
        wholesaleEmail: "shared@buyer.test",
      },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate_email" });

    const listed = await app.inject({
      method: "GET",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
    });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as { items: unknown[] }).items).toHaveLength(1);
  });

  it("rolls back when invite delivery fails so retry is not duplicate_email", async () => {
    const failingEmail = new FailingEmailSender();
    const { app, cookie } = await startCustomersApp({ emailSender: failingEmail });
    const admin = await cookie("admin");

    const failed = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Retry Customer",
        terms: "Net 30",
        wholesaleEmail: "retry@buyer.test",
      },
    });

    expect(failed.statusCode).toBe(502);
    expect(failed.json()).toEqual({ error: "invite_failed" });
    expect(failingEmail.sent).toHaveLength(1);

    const listedAfterFailure = await app.inject({
      method: "GET",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
    });
    expect((listedAfterFailure.json() as { items: unknown[] }).items).toHaveLength(0);

    const { app: retryApp, cookie: retryCookie, emailSender: retryEmailSender } =
      await startCustomersApp();
    const retryAdmin = await retryCookie("admin");

    const created = await retryApp.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: retryAdmin },
      payload: {
        name: "Retry Customer",
        terms: "Net 30",
        wholesaleEmail: "retry@buyer.test",
      },
    });

    expect(created.statusCode).toBe(201);
    expect(retryEmailSender.sent).toHaveLength(1);
  });

  it("deletes a customer and its wholesale login", async () => {
    const { app, cookie } = await startCustomersApp();
    const admin = await cookie("admin");

    const created = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Disposable Buyer",
        terms: "Net 30",
        wholesaleEmail: "disposable@buyer.test",
        wholesaleDisplayName: "Disposable Buyer",
      },
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as { id: string; customerNumber: string };
    expect(createdBody.customerNumber).toBe("CUST-00001");
    const customerId = createdBody.id;

    const deleted = await app.inject({
      method: "DELETE",
      url: `/internal/customers/${customerId}`,
      cookies: { [STAFF_SESSION_COOKIE]: admin },
    });
    expect(deleted.statusCode).toBe(204);

    const missing = await app.inject({
      method: "GET",
      url: `/internal/customers/${customerId}`,
      cookies: { [STAFF_SESSION_COOKIE]: admin },
    });
    expect(missing.statusCode).toBe(404);

    const recreate = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Disposable Buyer",
        terms: "Net 30",
        wholesaleEmail: "disposable@buyer.test",
        wholesaleDisplayName: "Disposable Buyer",
      },
    });
    expect(recreate.statusCode).toBe(201);
    expect((recreate.json() as { customerNumber: string }).customerNumber).toBe("CUST-00002");
  });

  it("refuses to delete a customer with orders or AR", async () => {
    const occupancy = new InMemoryCustomerOccupancyReadPort();
    const { app, cookie } = await startCustomersApp({ customerOccupancy: occupancy });
    const admin = await cookie("admin");

    const created = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        name: "Busy Buyer",
        terms: "Net 30",
        wholesaleEmail: "busy@buyer.test",
        wholesaleDisplayName: "Busy Buyer",
      },
    });
    expect(created.statusCode).toBe(201);
    const customerId = created.json().id as string;
    occupancy.markOccupied(OrganizationId.DEFAULT, CustomerId.parse(customerId));

    const refused = await app.inject({
      method: "DELETE",
      url: `/internal/customers/${customerId}`,
      cookies: { [STAFF_SESSION_COOKIE]: admin },
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ error: "customer_not_empty" });
  });
});
