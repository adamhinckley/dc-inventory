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
import { InMemoryCatalogSkuLookupPort } from "@dc-inventory/purchasing";

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
  const catalog = new InMemoryCatalogSkuLookupPort();
  catalog.set(OrganizationId.DEFAULT, "HEX-BOLT-GALV", "Hex bolt from Catalog");
  catalog.set(OrganizationId.DEFAULT, "WASHER-SS", "Washer from Catalog");
  catalog.set(OrganizationId.DEFAULT, "DEM-00003", "Connector metallic plug");
  catalog.set(OrganizationId.DEFAULT, "DEM-00004", "Hook taper pin");
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
    catalogSkuLookup: catalog,
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
    expect(created.json()).toMatchObject({ shipDate: null, cancelDate: null });
    expect(created.json()).toMatchObject({
      lines: [{ sku: "HEX-BOLT-GALV", name: "Hex bolt from Catalog", qty: 5 }],
    });

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

  it("replaces lines on a draft purchase order and rejects confirmed", async () => {
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
    const po = created.json() as { id: string; lines: Array<{ id: string }> };

    const replaced = await app.inject({
      method: "PATCH",
      url: `/internal/purchase-orders/${po.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        lines: [
          { sku: "HEX-BOLT-GALV", name: "Hex bolt updated", qty: 8 },
          { sku: "WASHER-SS", name: "Washer", qty: 2 },
        ],
      },
    });
    expect(replaced.statusCode).toBe(200);
    const updated = replaced.json() as {
      status: string;
      lines: Array<{ name: string; qty: number; receivedQty: number }>;
    };
    expect(updated.status).toBe("draft");
    expect(updated.lines).toHaveLength(2);
    expect(updated.lines[0]).toMatchObject({
      name: "Hex bolt from Catalog",
      qty: 8,
      receivedQty: 0,
    });

    const withDates = await app.inject({
      method: "PATCH",
      url: `/internal/purchase-orders/${po.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        shipDate: "2026-12-01",
        cancelDate: "2026-01-15",
        lines: [
          { sku: "HEX-BOLT-GALV", name: "Hex bolt updated", qty: 8 },
          { sku: "WASHER-SS", name: "Washer", qty: 2 },
        ],
      },
    });
    expect(withDates.statusCode).toBe(200);
    expect(withDates.json()).toMatchObject({
      shipDate: "2026-12-01",
      cancelDate: "2026-01-15",
    });

    const confirmed = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-confirm-after-replace" },
    });
    expect(confirmed.statusCode).toBe(200);

    const blocked = await app.inject({
      method: "PATCH",
      url: `/internal/purchase-orders/${po.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { lines: [{ sku: "HEX-BOLT-GALV", name: "Too late", qty: 1 }] },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({ error: "conflict" });
  });

  it("rejects duplicate SKU lines on replace and confirms the previous unique draft", async () => {
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
    const po = created.json() as { id: string };

    const duplicateReplace = await app.inject({
      method: "PATCH",
      url: `/internal/purchase-orders/${po.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        lines: [
          { sku: "DEM-00003", name: "Connector metallic plug", qty: 1 },
          { sku: "DEM-00003", name: "Connector metallic plug", qty: 1 },
          { sku: "DEM-00004", name: "Hook taper pin", qty: 1 },
          { sku: "DEM-00003", name: "Connector metallic plug", qty: 1 },
          { sku: "DEM-00004", name: "Hook taper pin", qty: 1 },
        ],
      },
    });
    expect(duplicateReplace.statusCode).toBe(400);
    expect(duplicateReplace.json()).toEqual({ error: "invalid" });

    const confirmed = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-confirm-after-duplicate-patch" },
    });
    expect(confirmed.statusCode).toBe(200);
    const confirmedPo = confirmed.json() as {
      status: string;
      lines: Array<{ sku: string; qty: number }>;
    };
    expect(confirmedPo.status).toBe("confirmed");
    expect(confirmedPo.lines).toEqual([
      expect.objectContaining({ sku: "HEX-BOLT-GALV", qty: 5 }),
    ]);
  });

  it("exports purchase order lines as xlsx and returns 404 for missing id", async () => {
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
    const po = created.json() as { id: string };

    const exported = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/export?format=xlsx`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(exported.headers["content-disposition"]).toMatch(/PO-00001\.xlsx/);
    expect(exported.rawPayload.length).toBeGreaterThan(0);

    const confirmed = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-export-confirm" },
    });
    expect(confirmed.statusCode).toBe(200);

    const exportedConfirmed = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/export?format=xlsx`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(exportedConfirmed.statusCode).toBe(200);

    const missing = await app.inject({
      method: "GET",
      url: "/internal/purchase-orders/99999999-9999-4999-8999-999999999999/export?format=xlsx",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "not_found" });
  });
});
