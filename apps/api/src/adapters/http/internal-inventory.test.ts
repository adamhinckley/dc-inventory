import {
  CreateProductUseCase,
  InMemoryProductPackagingRepository,
  InMemoryProductRepository,
} from "@dc-inventory/catalog";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import type { IStockLedger } from "@dc-inventory/inventory";
import {
  CreateSellWindowUseCase,
  InMemorySellWindowRepository,
} from "@dc-inventory/inventory";
import { buildApp } from "../../app.js";
import type { IUnitOfWork } from "../../domain/unit-of-work.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { InMemoryUnitOfWork } from "../in-memory-unit-of-work.js";
import { InventoryReadModelQtyReadAdapter } from "../inventory-read-model-qty-read.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440010");
const SKU_A = Sku.parse("REOPEN-HTTP-A");
const SKU_B = Sku.parse("REOPEN-HTTP-B");
const WINDOW_OPENS = "2026-07-01T00:00:00.000Z";
const WINDOW_CLOSES = "2026-08-01T00:00:00.000Z";
const INSIDE_WINDOW = new Date("2026-07-15T12:00:00.000Z");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startReopenApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  await staffUsers.save({
    id: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });

  const productRepo = new InMemoryProductRepository();
  const packagingRepo = new InMemoryProductPackagingRepository();
  const createProduct = new CreateProductUseCase(productRepo);
  for (const [sku, name] of [
    [SKU_A.value, "Reopen A"],
    [SKU_B.value, "Reopen B"],
  ] as const) {
    const created = await createProduct.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      sku,
      name,
      uom: "EA",
      memberPriceCents: 1000,
      taxCategoryCode: "P0000000",
    });
    if (!created.ok) {
      throw new Error(`expected product ${sku}`);
    }
  }

  const unitOfWork = new InMemoryUnitOfWork(
    {
      getBillToSnapshot: async () => null,
    },
    {
      getTerms: async () => "NET30",
    },
    new InMemoryClock(INSIDE_WINDOW),
  );

  for (const [sku, key] of [
    [SKU_A, "reopen-http-lock-a"],
    [SKU_B, "reopen-http-lock-b"],
  ] as const) {
    const locked = await unitOfWork.inventory.ledger.recordInboundFromPo({
      organizationId: OrganizationId.DEFAULT,
      idempotencyKey: key,
      sku,
      quantity: 10,
      refType: "purchase_order",
      refId: PO_ID,
    });
    if (!locked.ok) {
      throw new Error(`expected lock for ${sku.value}`);
    }
  }

  const postgresLikeUnitOfWork: IUnitOfWork = {
    inventory: {
      ledger: null as unknown as IStockLedger,
      readModel: unitOfWork.inventory.readModel,
    },
    purchasing: unitOfWork.purchasing,
    sales: unitOfWork.sales,
    run: (work) => unitOfWork.run(work),
  };

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(INSIDE_WINDOW),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    productRepo,
    productPackagingRepo: packagingRepo,
    unitOfWork: postgresLikeUnitOfWork,
    qtyRead: new InventoryReadModelQtyReadAdapter(unitOfWork.inventory.readModel),
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
  const session = login.cookies.find((cookie) => cookie.name === STAFF_SESSION_COOKIE)?.value;
  if (!session) {
    throw new Error("expected staff session");
  }
  return session;
}

describe("POST /internal/inventory/reopen-skus", () => {
  it("requires staff auth", async () => {
    const app = await startReopenApp();
    const response = await app.inject({
      method: "POST",
      url: "/internal/inventory/reopen-skus",
      payload: { skus: [SKU_A.value] },
    });
    expect(response.statusCode).toBe(401);
  });

  it("reopens listed SKUs with an optional shared sell window", async () => {
    const app = await startReopenApp();
    const session = await staffCookie(app);

    const reopen = await app.inject({
      method: "POST",
      url: "/internal/inventory/reopen-skus",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
      payload: {
        skus: [SKU_A.value, SKU_B.value],
        windowOpensAt: WINDOW_OPENS,
        windowClosesAt: WINDOW_CLOSES,
      },
    });
    expect(reopen.statusCode).toBe(200);
    expect(reopen.json()).toEqual({ reopenedCount: 2 });

    const list = await app.inject({
      method: "GET",
      url: "/internal/products?q=REOPEN-HTTP",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
    });
    expect(list.statusCode).toBe(200);
    const items = list.json().items as Array<{
      sku: string;
      sellState: string;
    }>;
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.sellState).toBe("open");
    }
  });

  it("returns 400 for an invalid sell window", async () => {
    const app = await startReopenApp();
    const session = await staffCookie(app);

    const reopen = await app.inject({
      method: "POST",
      url: "/internal/inventory/reopen-skus",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
      payload: {
        skus: [SKU_A.value],
        windowOpensAt: WINDOW_CLOSES,
        windowClosesAt: WINDOW_OPENS,
      },
    });
    expect(reopen.statusCode).toBe(400);
    expect(reopen.json()).toEqual({ error: "invalid" });
  });
});

describe("POST /internal/inventory/close-skus", () => {
  it("requires staff auth", async () => {
    const app = await startReopenApp();
    const response = await app.inject({
      method: "POST",
      url: "/internal/inventory/close-skus",
      payload: { skus: [SKU_A.value] },
    });
    expect(response.statusCode).toBe(401);
  });

  it("closes listed SKUs and returns closed count", async () => {
    const app = await startReopenApp();
    const session = await staffCookie(app);

    const reopen = await app.inject({
      method: "POST",
      url: "/internal/inventory/reopen-skus",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
      payload: {
        skus: [SKU_A.value, SKU_B.value],
        windowOpensAt: WINDOW_OPENS,
        windowClosesAt: WINDOW_CLOSES,
      },
    });
    expect(reopen.statusCode).toBe(200);

    const close = await app.inject({
      method: "POST",
      url: "/internal/inventory/close-skus",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
      payload: { skus: [SKU_A.value, SKU_B.value] },
    });
    expect(close.statusCode).toBe(200);
    expect(close.json()).toEqual({ closedCount: 2 });

    const list = await app.inject({
      method: "GET",
      url: "/internal/products?q=REOPEN-HTTP",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
    });
    expect(list.statusCode).toBe(200);
    const items = list.json().items as Array<{
      sku: string;
      sellState: string;
    }>;
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.sellState).toBe("locked");
    }
  });

  it("closes a sell window membership and sets manuallyClosedAt", async () => {
    const passwords = new InMemoryPasswordHasher();
    const organizations = new InMemoryOrganizationRepository();
    await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
    const staffUsers = new InMemoryStaffUserRepository();
    const sessions = new InMemorySessionStore();
    await staffUsers.save({
      id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
      email: "staff@local.test",
      passwordHash: await passwords.hash("staff-secret"),
      roles: ["admin"],
    });

    const productRepo = new InMemoryProductRepository();
    const packagingRepo = new InMemoryProductPackagingRepository();
    const createProduct = new CreateProductUseCase(productRepo);
    for (const [sku, name] of [
      [SKU_A.value, "Close A"],
      [SKU_B.value, "Close B"],
    ] as const) {
      const created = await createProduct.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: STAFF_ID,
        sku,
        name,
        uom: "EA",
        memberPriceCents: 1000,
        taxCategoryCode: "P0000000",
      });
      if (!created.ok) {
        throw new Error(`expected product ${sku}`);
      }
    }

    const unitOfWork = new InMemoryUnitOfWork(
      {
        getBillToSnapshot: async () => null,
      },
      {
        getTerms: async () => "NET30",
      },
      new InMemoryClock(INSIDE_WINDOW),
    );

    for (const [sku, key] of [
      [SKU_A, "close-http-lock-a"],
      [SKU_B, "close-http-lock-b"],
    ] as const) {
      const locked = await unitOfWork.inventory.ledger.recordInboundFromPo({
        organizationId: OrganizationId.DEFAULT,
        idempotencyKey: key,
        sku,
        quantity: 10,
        refType: "purchase_order",
        refId: PO_ID,
      });
      if (!locked.ok) {
        throw new Error(`expected lock for ${sku.value}`);
      }
    }

    const postgresLikeUnitOfWork: IUnitOfWork = {
      inventory: {
        ledger: null as unknown as IStockLedger,
        readModel: unitOfWork.inventory.readModel,
      },
      purchasing: unitOfWork.purchasing,
      sales: unitOfWork.sales,
      run: (work) => unitOfWork.run(work),
    };

    const sellWindowRepo = new InMemorySellWindowRepository();
    const clock = new InMemoryClock(INSIDE_WINDOW);
    const createSellWindow = new CreateSellWindowUseCase(sellWindowRepo, clock);
    const createdWindow = await createSellWindow.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      name: "Close via HTTP",
      filterSnapshot: {},
      windowOpensAt: new Date(WINDOW_OPENS),
      windowClosesAt: new Date(WINDOW_CLOSES),
      skus: [SKU_A, SKU_B],
    });
    if (!createdWindow.ok) {
      throw new Error("expected sell window");
    }

    const app = await buildApp({
      logger: false,
      database: new InMemoryDatabase(),
      clock,
      staffUsers,
      sessions,
      passwords,
      organizationRepo: organizations,
      productRepo,
      productPackagingRepo: packagingRepo,
      unitOfWork: postgresLikeUnitOfWork,
      sellWindowRepo,
      qtyRead: new InventoryReadModelQtyReadAdapter(unitOfWork.inventory.readModel),
    });
    apps.push(app);
    const session = await staffCookie(app);

    const reopen = await app.inject({
      method: "POST",
      url: "/internal/inventory/reopen-skus",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
      payload: {
        skus: [SKU_A.value, SKU_B.value],
        windowOpensAt: WINDOW_OPENS,
        windowClosesAt: WINDOW_CLOSES,
      },
    });
    expect(reopen.statusCode).toBe(200);

    const close = await app.inject({
      method: "POST",
      url: "/internal/inventory/close-skus",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
      payload: { windowId: createdWindow.window.id },
    });
    expect(close.statusCode).toBe(200);
    expect(close.json()).toEqual({ closedCount: 2 });

    const detail = await app.inject({
      method: "GET",
      url: `/internal/inventory/sell-windows/${createdWindow.window.id}`,
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      status: "closed",
      manuallyClosedAt: INSIDE_WINDOW.toISOString(),
    });
  });
});
