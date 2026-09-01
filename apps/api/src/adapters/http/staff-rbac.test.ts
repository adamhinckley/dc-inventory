import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  type StaffRole,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";

const RESOURCE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const LINE_ID = "33333333-3333-4333-8333-333333333333";
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startRbacApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });

  for (const [index, role] of (
    ["admin", "purchasing", "warehouse", "sales_support"] as const
  ).entries()) {
    await staffUsers.save({
      id: StaffUserId.parse(`10000000-0000-4000-8000-00000000000${index}`),
      organizationId: OrganizationId.DEFAULT,
      email: `${role}@local.test`,
      passwordHash: await passwords.hash("staff-secret"),
      roles: [role],
    });
  }

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-29T01:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
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
    expect(login.json().roles).toEqual([role]);
    const value = login.cookies.find((item) => item.name === STAFF_SESSION_COOKIE)?.value;
    if (value === undefined) {
      throw new Error("expected staff session cookie");
    }
    return value;
  }

  return { app, cookie };
}

function expectForbidden(response: { statusCode: number; json(): unknown }): void {
  expect(response.statusCode).toBe(403);
  expect(response.json()).toEqual({ error: "forbidden" });
}

describe("staff RBAC HTTP guard", () => {
  it("gates catalog and purchasing commands before resource lookup", async () => {
    const { app, cookie } = await startRbacApp();
    const warehouse = await cookie("warehouse");
    const purchasing = await cookie("purchasing");

    expectForbidden(
      await app.inject({
        method: "POST",
        url: "/internal/products",
        cookies: { [STAFF_SESSION_COOKIE]: warehouse },
        payload: {
          sku: "RBAC-1",
          name: "RBAC test product",
          uom: "EA",
          masterPackPrice: 100,
        },
      }),
    );

    expectForbidden(
      await app.inject({
        method: "POST",
        url: "/internal/purchase-orders",
        cookies: { [STAFF_SESSION_COOKIE]: warehouse },
        payload: {
          supplierId: RESOURCE_ID,
          lines: [{ sku: "RBAC-1", name: "RBAC test product", qty: 1 }],
        },
      }),
    );

    const allowedPurchase = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        supplierId: RESOURCE_ID,
        lines: [{ sku: "RBAC-1", name: "RBAC test product", qty: 1 }],
      },
    });
    expect(allowedPurchase.statusCode).toBe(404);
  });

  it("gates stock receive, PO confirmation, and shipping commands", async () => {
    const { app, cookie } = await startRbacApp();
    const purchasing = await cookie("purchasing");
    const warehouse = await cookie("warehouse");
    const salesSupport = await cookie("sales_support");

    expectForbidden(
      await app.inject({
        method: "POST",
        url: `/internal/purchase-orders/${RESOURCE_ID}/receive`,
        cookies: { [STAFF_SESSION_COOKIE]: purchasing },
        payload: {
          idempotencyKey: "receive-forbidden",
          lines: [{ lineId: LINE_ID, quantity: 1 }],
        },
      }),
    );

    const allowedReceive = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${RESOURCE_ID}/receive`,
      cookies: { [STAFF_SESSION_COOKIE]: warehouse },
      payload: {
        idempotencyKey: "receive-allowed",
        lines: [{ lineId: LINE_ID, quantity: 1 }],
      },
    });
    expect(allowedReceive.statusCode).toBe(404);

    expectForbidden(
      await app.inject({
        method: "POST",
        url: `/internal/purchase-orders/${RESOURCE_ID}/confirm`,
        cookies: { [STAFF_SESSION_COOKIE]: warehouse },
        payload: { idempotencyKey: "confirm-po-forbidden" },
      }),
    );
    const allowedConfirm = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${RESOURCE_ID}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: { idempotencyKey: "confirm-po-allowed" },
    });
    expect(allowedConfirm.statusCode).toBe(404);

    expectForbidden(
      await app.inject({
        method: "POST",
        url: `/internal/sales-orders/${RESOURCE_ID}/ship`,
        cookies: { [STAFF_SESSION_COOKIE]: salesSupport },
        payload: { idempotencyKey: "ship-forbidden" },
      }),
    );
    const allowedShip = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${RESOURCE_ID}/ship`,
      cookies: { [STAFF_SESSION_COOKIE]: warehouse },
      payload: { idempotencyKey: "ship-allowed" },
    });
    expect(allowedShip.statusCode).toBe(404);
  });

  it("gates sales-support and payment commands", async () => {
    const { app, cookie } = await startRbacApp();
    const purchasing = await cookie("purchasing");
    const salesSupport = await cookie("sales_support");
    const admin = await cookie("admin");

    expectForbidden(
      await app.inject({
        method: "POST",
        url: "/internal/sales-orders",
        cookies: { [STAFF_SESSION_COOKIE]: purchasing },
        payload: {
          customerId: RESOURCE_ID,
          lines: [{ productId: PRODUCT_ID, qty: 1 }],
        },
      }),
    );
    const allowedSales = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: salesSupport },
      payload: {
        customerId: RESOURCE_ID,
        lines: [{ productId: PRODUCT_ID, qty: 1 }],
      },
    });
    expect(allowedSales.statusCode).toBe(404);

    expectForbidden(
      await app.inject({
        method: "POST",
        url: `/internal/invoices/${RESOURCE_ID}/record-payment`,
        cookies: { [STAFF_SESSION_COOKIE]: salesSupport },
        payload: {
          amountCents: 100,
          currency: "USD",
          idempotencyKey: "payment-forbidden",
        },
      }),
    );
    const allowedPayment = await app.inject({
      method: "POST",
      url: `/internal/invoices/${RESOURCE_ID}/record-payment`,
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        amountCents: 100,
        currency: "USD",
        idempotencyKey: "payment-allowed",
      },
    });
    expect(allowedPayment.statusCode).toBe(404);
  });
});
