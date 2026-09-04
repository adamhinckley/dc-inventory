import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  type StaffRole,
} from "@dc-inventory/identity";
import { InMemoryProductRepository } from "@dc-inventory/catalog";
import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import { RecordAdjustmentIncreaseUseCase } from "@dc-inventory/inventory";
import {
  CustomerId,
  Money,
  OrganizationId,
  ProductId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { testShipAccountingReadPorts } from "../../adapters/test-ship-accounting-readports.js";
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
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU_A = Sku.parse("SHORT-A");
const SKU_B = Sku.parse("SHORT-B");
const PRODUCT_A_ID = ProductId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
const PRODUCT_B_ID = ProductId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

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
  const shipPorts = testShipAccountingReadPorts();
  const unitOfWork = new InMemoryUnitOfWork(shipPorts.billToSnapshot, shipPorts.customerTerms);
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
    roles: ["admin"],
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

  it("gets a purchase order by exact document number", async () => {
    const app = await startPurchasingApp();
    const cookie = await staffCookie(app);

    const created = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [{ sku: "HEX-BOLT-GALV", name: "Hex bolt", qty: 12 }],
      },
    });
    expect(created.statusCode).toBe(201);
    const po = created.json() as { id: string; documentNumber: string };

    const found = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/by-document-number/${po.documentNumber}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(found.statusCode).toBe(200);
    expect(found.json()).toMatchObject({
      id: po.id,
      documentNumber: po.documentNumber,
      status: "draft",
    });

    const missing = await app.inject({
      method: "GET",
      url: "/internal/purchase-orders/by-document-number/PO-99999",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "not_found" });
  });

  it("lists goods-received history for a purchase order", async () => {
    const app = await startPurchasingApp();
    const cookie = await staffCookie(app);

    const created = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [{ sku: "HEX-BOLT-GALV", name: "Hex bolt", qty: 100 }],
      },
    });
    expect(created.statusCode).toBe(201);
    const po = created.json() as { id: string; lines: Array<{ id: string }> };

    const unauthorized = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/goods-received`,
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toEqual({ error: "unauthorized" });

    const missing = await app.inject({
      method: "GET",
      url: "/internal/purchase-orders/99999999-9999-4999-8999-999999999999/goods-received",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "not_found" });

    const empty = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/goods-received`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ items: [] });

    await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-gr-hist-confirm" },
    });

    const firstReceive = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/receive`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        idempotencyKey: "http-gr-hist-receive-1",
        lines: [{ lineId: po.lines[0]!.id, quantity: 40 }],
      },
    });
    expect(firstReceive.statusCode).toBe(200);

    const secondReceive = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/receive`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        idempotencyKey: "http-gr-hist-receive-2",
        lines: [{ lineId: po.lines[0]!.id, quantity: 60 }],
      },
    });
    expect(secondReceive.statusCode).toBe(200);

    const history = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/goods-received`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(history.statusCode).toBe(200);
    const body = history.json() as {
      items: Array<{ createdAt: string; sku: string; quantity: number }>;
    };
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ sku: "HEX-BOLT-GALV", quantity: 40 });
    expect(body.items[1]).toMatchObject({ sku: "HEX-BOLT-GALV", quantity: 60 });
    expect(Date.parse(body.items[0]!.createdAt)).toBeLessThanOrEqual(
      Date.parse(body.items[1]!.createdAt),
    );
    expect(body.items[0]).not.toHaveProperty("idempotencyKey");
    expect(body.items[0]).not.toHaveProperty("actor");
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

    const listed = await app.inject({
      method: "GET",
      url: "/internal/purchase-orders?status=draft",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      items: [
        expect.objectContaining({
          id: po.id,
          supplierId: SUPPLIER_ID,
          supplierName: PHASE2_SUPPLIER_NAME,
        }),
      ],
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
        lines: [{ sku: "HEX-BOLT-GALV", name: "Caller hex bolt label", qty: 5 }],
      },
    });
    expect(created.statusCode).toBe(201);
    const po = created.json() as { id: string };
    expect(created.json()).toMatchObject({
      lines: [{ sku: "HEX-BOLT-GALV", name: "Hex bolt from Catalog", qty: 5 }],
    });

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

    const factorySend = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/factory-send`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(factorySend.statusCode).toBe(200);
    expect(factorySend.json()).toMatchObject({
      columns: expect.arrayContaining([
        { key: "mat_num", header: "mat_num" },
        { key: "tot_cartons", header: "tot_cartons" },
      ]),
      rows: [
        expect.objectContaining({
          mat_num: "HEX-BOLT-GALV",
          quan: 5,
          description: "Hex bolt from Catalog",
          tot_cbm: "Not Available",
          blocks_tot_cartons: true,
        }),
      ],
    });

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

  it("gates and runs cancel remaining on partially received purchase orders", async () => {
    const passwords = new InMemoryPasswordHasher();
    const organizations = new InMemoryOrganizationRepository();
    await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
    const staffUsers = new InMemoryStaffUserRepository();
    const sessions = new InMemorySessionStore();
    const shipPorts = testShipAccountingReadPorts();
  const unitOfWork = new InMemoryUnitOfWork(shipPorts.billToSnapshot, shipPorts.customerTerms);
    const catalog = new InMemoryCatalogSkuLookupPort();
    catalog.set(OrganizationId.DEFAULT, "HEX-BOLT-GALV", "Hex bolt from Catalog");
    await unitOfWork.suppliers.save({
      id: SUPPLIER_ID,
      organizationId: OrganizationId.DEFAULT,
      vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
      name: PHASE2_SUPPLIER_NAME,
    });

    for (const [index, role] of (
      ["admin", "warehouse", "purchasing"] as const
    ).entries()) {
      await staffUsers.save({
        id: StaffUserId.parse(`20000000-0000-4000-8000-00000000000${index}`),
        organizationId: OrganizationId.DEFAULT,
        email: `${role}@cancel-remaining.test`,
        passwordHash: await passwords.hash("staff-secret"),
        roles: [role],
      });
    }

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

    async function roleCookie(role: StaffRole): Promise<string> {
      const login = await app.inject({
        method: "POST",
        url: "/internal/auth/login",
        payload: {
          organizationSlug: "acme",
          email: `${role}@cancel-remaining.test`,
          password: "staff-secret",
        },
      });
      const value = login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value;
      return value ?? "";
    }

    const adminCookie = await roleCookie("admin");
    const created = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: adminCookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [{ sku: "HEX-BOLT-GALV", name: "Hex bolt", qty: 100 }],
      },
    });
    expect(created.statusCode).toBe(201);
    const po = created.json() as { id: string; lines: Array<{ id: string }> };

    await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: adminCookie },
      payload: { idempotencyKey: "http-cancel-remaining-confirm" },
    });

    await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/receive`,
      cookies: { [STAFF_SESSION_COOKIE]: adminCookie },
      payload: {
        idempotencyKey: "http-cancel-remaining-receive",
        lines: [{ lineId: po.lines[0]!.id, quantity: 90 }],
      },
    });

    const unauthorized = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/cancel-remaining`,
      payload: { idempotencyKey: "http-cancel-remaining-unauth" },
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toEqual({ error: "unauthorized" });

    const warehouseCookie = await roleCookie("warehouse");
    const warehouseForbidden = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/cancel-remaining`,
      cookies: { [STAFF_SESSION_COOKIE]: warehouseCookie },
      payload: { idempotencyKey: "http-cancel-remaining-warehouse" },
    });
    expect(warehouseForbidden.statusCode).toBe(403);
    expect(warehouseForbidden.json()).toEqual({ error: "forbidden" });

    const purchasingCookie = await roleCookie("purchasing");
    const purchasingForbidden = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/cancel-remaining`,
      cookies: { [STAFF_SESSION_COOKIE]: purchasingCookie },
      payload: { idempotencyKey: "http-cancel-remaining-purchasing" },
    });
    expect(purchasingForbidden.statusCode).toBe(403);
    expect(purchasingForbidden.json()).toEqual({ error: "forbidden" });

    const closed = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/cancel-remaining`,
      cookies: { [STAFF_SESSION_COOKIE]: adminCookie },
      payload: { idempotencyKey: "http-cancel-remaining-admin" },
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toMatchObject({
      status: "received",
      lines: [{ receivedQty: 90, qty: 100 }],
    });

    const draftPo = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: adminCookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [{ sku: "HEX-BOLT-GALV", name: "Hex bolt", qty: 5 }],
      },
    });
    expect(draftPo.statusCode).toBe(201);
    const draft = draftPo.json() as { id: string };

    const illegal = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${draft.id}/cancel-remaining`,
      cookies: { [STAFF_SESSION_COOKIE]: adminCookie },
      payload: { idempotencyKey: "http-cancel-remaining-illegal" },
    });
    expect(illegal.statusCode).toBe(409);
    expect(illegal.json()).toEqual({ error: "conflict" });
  });

  it("returns short readout with uncovered rows and affected customers", async () => {
    const passwords = new InMemoryPasswordHasher();
    const organizations = new InMemoryOrganizationRepository();
    await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
    const staffUsers = new InMemoryStaffUserRepository();
    const sessions = new InMemorySessionStore();
    const customerRepo = new InMemoryCustomerRepository();
    const productRepo = new InMemoryProductRepository();
    const shipPorts = testShipAccountingReadPorts();
  const unitOfWork = new InMemoryUnitOfWork(shipPorts.billToSnapshot, shipPorts.customerTerms);
    const catalog = new InMemoryCatalogSkuLookupPort();
    catalog.set(OrganizationId.DEFAULT, SKU_A.value, "Short A");
    catalog.set(OrganizationId.DEFAULT, SKU_B.value, "Short B");
    await unitOfWork.suppliers.save({
      id: SUPPLIER_ID,
      organizationId: OrganizationId.DEFAULT,
      vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
      name: PHASE2_SUPPLIER_NAME,
    });
    await customerRepo.save({
      id: CUSTOMER_ID,
      organizationId: OrganizationId.DEFAULT,
      name: "Acme Wholesale",
      creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
      terms: "NET30",
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
    });
    await productRepo.save({
      id: PRODUCT_A_ID,
      organizationId: OrganizationId.DEFAULT,
      sku: SKU_A,
      name: "Short A product",
      description: null,
      uom: "EA",
      memberPrice: Money.fromMinorUnits(100, "USD"),
      listPrice: Money.fromMinorUnits(100, "USD"),
      inactive: false,
      discontinued: false,
      webWholesale: true,
      taxCategoryCode: "TANGIBLE",
    });
    await productRepo.save({
      id: PRODUCT_B_ID,
      organizationId: OrganizationId.DEFAULT,
      sku: SKU_B,
      name: "Short B product",
      description: null,
      uom: "EA",
      memberPrice: Money.fromMinorUnits(100, "USD"),
      listPrice: Money.fromMinorUnits(100, "USD"),
      inactive: false,
      discontinued: false,
      webWholesale: true,
      taxCategoryCode: "TANGIBLE",
    });
    await staffUsers.save({
      id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
      email: "staff@local.test",
      passwordHash: await passwords.hash("staff-secret"),
      roles: ["admin"],
    });

    const app = await buildApp({
      logger: false,
      database: new InMemoryDatabase(),
      clock: new InMemoryClock(new Date("2026-09-02T00:00:00.000Z")),
      staffUsers,
      sessions,
      passwords,
      organizationRepo: organizations,
      unitOfWork,
      purchaseOrderRepo: unitOfWork.purchaseOrders,
      supplierRepo: unitOfWork.suppliers,
      catalogSkuLookup: catalog,
      customerRepo,
      productRepo,
      salesOrderRepo: unitOfWork.salesOrders,
    });
    apps.push(app);
    const cookie = await staffCookie(app);

    const unauthorized = await app.inject({
      method: "GET",
      url: "/internal/purchase-orders/99999999-9999-4999-8999-999999999999/short-readout",
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toEqual({ error: "unauthorized" });

    const missing = await app.inject({
      method: "GET",
      url: "/internal/purchase-orders/99999999-9999-4999-8999-999999999999/short-readout",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "not_found" });

    const salesOrder = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        customerId: CUSTOMER_ID,
        lines: [{ productId: PRODUCT_A_ID, qty: 10 }],
      },
    });
    expect(salesOrder.statusCode).toBe(201);
    const order = salesOrder.json() as { id: string };

    const confirmed = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "short-readout-confirm-so" },
    });
    expect(confirmed.statusCode).toBe(200);

    const created = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [
          { sku: SKU_A.value, name: "Short A", qty: 5 },
          { sku: SKU_B.value, name: "Short B", qty: 3 },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const po = created.json() as { id: string };

    const readout = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/short-readout`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(readout.statusCode).toBe(200);
    expect(readout.json()).toEqual({
      uncovered: [
        { sku: SKU_A.value, uncovered: 10 },
        { sku: SKU_B.value, uncovered: 0 },
      ],
      affectedCustomers: [{ customerId: CUSTOMER_ID, name: "Acme Wholesale" }],
    });

    await unitOfWork.run(async (scope) => {
      const stocked = await new RecordAdjustmentIncreaseUseCase(scope.inventory.ledger).execute({
        organizationId: OrganizationId.DEFAULT,
        idempotencyKey: "short-readout-stock-a",
        sku: SKU_A,
        quantity: 10,
        refType: "adjustment",
        refId: "short-readout",
      });
      expect(stocked.ok).toBe(true);
    });

    const cleared = await app.inject({
      method: "GET",
      url: `/internal/purchase-orders/${po.id}/short-readout`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toEqual({
      uncovered: [
        { sku: SKU_A.value, uncovered: 0 },
        { sku: SKU_B.value, uncovered: 0 },
      ],
      affectedCustomers: [],
    });
  });
});
