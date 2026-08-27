import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import { OrganizationId, SupplierId, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";
import {
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SUPPLIER_ID = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startPurchasingApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const unitOfWork = new InMemoryUnitOfWork();
  await unitOfWork.suppliers.save({
    id: SUPPLIER_ID,
    organizationId: OrganizationId.DEFAULT,
    vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
    name: PHASE2_SUPPLIER_NAME,
  });

  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
  });
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-24T03:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    unitOfWork,
    purchaseOrderRepo: unitOfWork.purchaseOrders,
    supplierRepo: unitOfWork.suppliers,
  });
  apps.push(app);
  return app;
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: loginBody("staff@local.test", "staff-secret"),
  });
  const cookie = login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE);
  return cookie?.value ?? "";
}

describe("internal purchase orders HTTP", () => {
  it("requires staff_session", async () => {
    const app = await startPurchasingApp();
    const response = await app.inject({ method: "GET", url: "/internal/purchase-orders" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects invalid create body with Zod", async () => {
    const app = await startPurchasingApp();
    const cookie = await staffCookie(app);
    const response = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { supplierId: SUPPLIER_ID, lines: [] },
    });
    expect(response.statusCode).toBe(400);
  });

  it("runs create, confirm, and receive", async () => {
    const app = await startPurchasingApp();
    const cookie = await staffCookie(app);

    const created = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [{ sku: "HEX-BOLT-GALV", name: "Hex bolt", qty: 5 }],
      },
    });
    expect(created.statusCode).toBe(201);
    const po = created.json() as { id: string; documentNumber: string; lines: Array<{ id: string }> };
    expect(po.documentNumber).toBe("PO-00001");

    const confirmed = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-confirm" },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ status: "confirmed" });

    const received = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/receive`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        idempotencyKey: "http-receive",
        lines: [{ lineId: po.lines[0]!.id, quantity: 5 }],
      },
    });
    expect(received.statusCode).toBe(200);
    expect(received.json()).toMatchObject({ status: "received" });
  });
});
