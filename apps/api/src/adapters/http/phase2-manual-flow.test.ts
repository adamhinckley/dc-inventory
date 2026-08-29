import { CreateProductUseCase, InMemoryProductRepository } from "@dc-inventory/catalog";
import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import {
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import {
  CustomerId,
  LocationId,
  Money,
  OrderId,
  Sku,
  OrganizationId,
  StaffUserId,
  SupplierId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SUPPLIER_ID = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SKU = Sku.parse("HEX-BOLT-GALV");
const RECEIVE_QTY = 10;
const SELL_QTY = 5;
const UNIT_PRICE_CENTS = 250;

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startPhase2ManualFlowApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  const productRepo = new InMemoryProductRepository();
  const unitOfWork = new InMemoryUnitOfWork();

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
  });

  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });

  await wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "wholesale@local.test",
    passwordHash: await passwords.hash("wholesale-secret"),
    customerId: CUSTOMER_ID,
  });

  const createProduct = new CreateProductUseCase(productRepo);
  const seeded = await createProduct.execute({
    organizationId: OrganizationId.DEFAULT,
    staffUserId: STAFF_ID,
    sku: SKU.value,
    name: "Galvanized hex bolt",
    uom: "EA",
    memberPriceCents: UNIT_PRICE_CENTS,
    currency: "USD",
    inactive: false,
    discontinued: false,
    webWholesale: true,
  });
  if (!seeded.ok) {
    throw new Error("expected product seed");
  }

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-24T04:00:00.000Z")),
    staffUsers,
    wholesaleUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    unitOfWork,
    customerRepo,
    productRepo,
    purchaseOrderRepo: unitOfWork.purchaseOrders,
    supplierRepo: unitOfWork.suppliers,
    salesOrderRepo: unitOfWork.salesOrders,
    invoiceRepo: unitOfWork.invoices,
  });
  apps.push(app);
  return { app, unitOfWork, productId: seeded.product.id };
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: loginBody("staff@local.test", "staff-secret"),
  });
  return login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value ?? "";
}

async function wholesaleCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: loginBody("wholesale@local.test", "wholesale-secret"),
  });
  return login.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
}

type StaffCommand = {
  label: string;
  run: (auth: "none" | "staff" | "wholesale") => Promise<{ statusCode: number; json: () => unknown }>;
};

function staffCommands(
  app: Awaited<ReturnType<typeof buildApp>>,
  ids: {
    poId: string;
    poLineId: string;
    orderId: string;
    invoiceId: string;
    productId: string;
  },
  staff: string,
  wholesale: string,
): StaffCommand[] {
  const cookiesFor = (auth: "none" | "staff" | "wholesale") => {
    if (auth === "staff") {
      return { [STAFF_SESSION_COOKIE]: staff };
    }
    if (auth === "wholesale") {
      return { [WHOLESALE_SESSION_COOKIE]: wholesale };
    }
    return undefined;
  };

  return [
    {
      label: "create purchase order",
      run: async (auth) =>
        app.inject({
          method: "POST",
          url: "/internal/purchase-orders",
          cookies: cookiesFor(auth),
          payload: {
            supplierId: SUPPLIER_ID,
            lines: [{ sku: SKU.value, name: "Hex bolt", qty: RECEIVE_QTY }],
          },
        }),
    },
    {
      label: "confirm purchase order",
      run: async (auth) =>
        app.inject({
          method: "POST",
          url: `/internal/purchase-orders/${ids.poId}/confirm`,
          cookies: cookiesFor(auth),
          payload: { idempotencyKey: "flow-confirm-po" },
        }),
    },
    {
      label: "receive purchase order",
      run: async (auth) =>
        app.inject({
          method: "POST",
          url: `/internal/purchase-orders/${ids.poId}/receive`,
          cookies: cookiesFor(auth),
          payload: {
            idempotencyKey: "flow-receive-po",
            lines: [{ lineId: ids.poLineId, quantity: RECEIVE_QTY }],
          },
        }),
    },
    {
      label: "list products",
      run: async (auth) =>
        app.inject({
          method: "GET",
          url: "/internal/products",
          cookies: cookiesFor(auth),
        }),
    },
    {
      label: "create sales order",
      run: async (auth) =>
        app.inject({
          method: "POST",
          url: "/internal/sales-orders",
          cookies: cookiesFor(auth),
          payload: {
            customerId: CUSTOMER_ID,
            lines: [{ productId: ids.productId, qty: SELL_QTY }],
          },
        }),
    },
    {
      label: "confirm sales order",
      run: async (auth) =>
        app.inject({
          method: "POST",
          url: `/internal/sales-orders/${ids.orderId}/confirm`,
          cookies: cookiesFor(auth),
          payload: { idempotencyKey: "flow-confirm-so" },
        }),
    },
    {
      label: "ship sales order",
      run: async (auth) =>
        app.inject({
          method: "POST",
          url: `/internal/sales-orders/${ids.orderId}/ship`,
          cookies: cookiesFor(auth),
          payload: { idempotencyKey: "flow-ship-so" },
        }),
    },
    {
      label: "read invoice",
      run: async (auth) =>
        app.inject({
          method: "GET",
          url: `/internal/invoices/${ids.invoiceId}`,
          cookies: cookiesFor(auth),
        }),
    },
    {
      label: "record payment",
      run: async (auth) =>
        app.inject({
          method: "POST",
          url: `/internal/invoices/${ids.invoiceId}/record-payment`,
          cookies: cookiesFor(auth),
          payload: {
            amountCents: SELL_QTY * UNIT_PRICE_CENTS,
            currency: "USD",
            idempotencyKey: "flow-payment",
          },
        }),
    },
  ];
}

describe("Phase 2 manual staff flow (PO to payment)", () => {
  it("creates wholesale and internal drafts through the shared Sales use case", async () => {
    const { app, productId } = await startPhase2ManualFlowApp();
    const staff = await staffCookie(app);
    const wholesale = await wholesaleCookie(app);

    const internal = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        customerId: CUSTOMER_ID,
        lines: [{ productId, qty: 1 }],
      },
    });
    const wholesaleOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
      payload: {
        lines: [{ productId, qty: 2 }],
      },
    });

    expect(internal.statusCode).toBe(201);
    expect(wholesaleOrder.statusCode).toBe(201);
    expect(wholesaleOrder.json()).toMatchObject({
      customerId: CUSTOMER_ID,
      documentNumber: "SO-00002",
      lines: [
        {
          sku: SKU.value,
          name: "Galvanized hex bolt",
          qty: 2,
          unitPriceCents: UNIT_PRICE_CENTS,
          currency: "USD",
        },
      ],
    });
  });

  it("drives PO receive, sales ship, invoice, and payment with reconciled quantities", async () => {
    const { app, unitOfWork, productId } = await startPhase2ManualFlowApp();
    const cookie = await staffCookie(app);

    const zeroStock = await unitOfWork.inventory.readModel.getSnapshot(
      SKU,
      LocationId.DEFAULT,
      OrganizationId.DEFAULT,
    );
    expect(zeroStock).toEqual({
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
    });

    const createdPo = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [{ sku: SKU.value, name: "Hex bolt", qty: RECEIVE_QTY }],
      },
    });
    expect(createdPo.statusCode).toBe(201);
    const po = createdPo.json() as {
      id: string;
      documentNumber: string;
      lines: Array<{ id: string }>;
    };
    expect(po.documentNumber).toBe("PO-00001");

    const confirmedPo = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "flow-confirm-po" },
    });
    expect(confirmedPo.statusCode).toBe(200);

    const receivedPo = await app.inject({
      method: "POST",
      url: `/internal/purchase-orders/${po.id}/receive`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        idempotencyKey: "flow-receive-po",
        lines: [{ lineId: po.lines[0]!.id, quantity: RECEIVE_QTY }],
      },
    });
    expect(receivedPo.statusCode).toBe(200);
    expect(receivedPo.json()).toMatchObject({ status: "received" });

    const afterReceive = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(afterReceive.statusCode).toBe(200);
    const productRow = (afterReceive.json().items as Array<{
      sku: string;
      onHand: number;
      onOrder: number;
      allocated: number;
      available: number;
    }>).find((row) => row.sku === SKU.value);
    expect(productRow).toMatchObject({
      onHand: RECEIVE_QTY,
      onOrder: 0,
      allocated: 0,
      available: RECEIVE_QTY,
    });

    const createdOrder = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        customerId: CUSTOMER_ID,
        lines: [{ productId, qty: SELL_QTY }],
      },
    });
    expect(createdOrder.statusCode).toBe(201);
    const order = createdOrder.json() as { id: string; documentNumber: string };
    expect(order.documentNumber).toBe("SO-00001");

    const confirmedOrder = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "flow-confirm-so" },
    });
    expect(confirmedOrder.statusCode).toBe(200);

    const shippedOrder = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/ship`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "flow-ship-so" },
    });
    expect(shippedOrder.statusCode).toBe(200);
    expect(shippedOrder.json()).toMatchObject({ status: "shipped" });

    const invoiceId = (
      await unitOfWork.invoices.findByOrderId(OrganizationId.DEFAULT, OrderId.parse(order.id))
    )?.id;
    expect(invoiceId).toBeDefined();
    if (invoiceId === undefined) {
      return;
    }

    const invoiceRead = await app.inject({
      method: "GET",
      url: `/internal/invoices/${invoiceId}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(invoiceRead.statusCode).toBe(200);
    const invoice = invoiceRead.json() as {
      documentNumber: string;
      totalCents: number;
      remainingCents: number;
      taxTotalCents: number;
    };
    expect(invoice.documentNumber).toBe("INV-00001");
    expect(invoice.taxTotalCents).toBe(0);
    expect(invoice.totalCents).toBe(SELL_QTY * UNIT_PRICE_CENTS);
    expect(invoice.remainingCents).toBe(SELL_QTY * UNIT_PRICE_CENTS);

    const payment = await app.inject({
      method: "POST",
      url: `/internal/invoices/${invoiceId}/record-payment`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        amountCents: SELL_QTY * UNIT_PRICE_CENTS,
        currency: "USD",
        idempotencyKey: "flow-payment",
      },
    });
    expect(payment.statusCode).toBe(200);
    expect(payment.json()).toEqual({
      remainingCents: 0,
      currency: "USD",
    });

    const finalSnapshot = await unitOfWork.inventory.readModel.getSnapshot(
      SKU,
      LocationId.DEFAULT,
      OrganizationId.DEFAULT,
    );
    expect(finalSnapshot).toEqual({
      onHand: RECEIVE_QTY - SELL_QTY,
      onOrder: 0,
      allocated: 0,
      available: RECEIVE_QTY - SELL_QTY,
    });

    const paidInvoice = await app.inject({
      method: "GET",
      url: `/internal/invoices/${invoiceId}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(paidInvoice.json()).toMatchObject({ remainingCents: 0 });
  });

  it("returns 401 without staff_session or with wholesale cookie on staff commands", async () => {
    const { app, productId } = await startPhase2ManualFlowApp();
    const cookie = await staffCookie(app);
    const wholesale = await wholesaleCookie(app);

    const createdPo = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        supplierId: SUPPLIER_ID,
        lines: [{ sku: SKU.value, name: "Hex bolt", qty: RECEIVE_QTY }],
      },
    });
    const po = createdPo.json() as { id: string; lines: Array<{ id: string }> };

    const createdOrder = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        customerId: CUSTOMER_ID,
        lines: [{ productId, qty: SELL_QTY }],
      },
    });
    const order = createdOrder.json() as { id: string };

    const invoiceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const commands = staffCommands(
      app,
      {
        poId: po.id,
        poLineId: po.lines[0]!.id,
        orderId: order.id,
        invoiceId,
        productId,
      },
      cookie,
      wholesale,
    );

    for (const command of commands) {
      const missing = await command.run("none");
      expect(missing.statusCode, `${command.label} without cookie`).toBe(401);
      expect(missing.json()).toEqual({ error: "unauthorized" });

      const withWholesale = await command.run("wholesale");
      expect(withWholesale.statusCode, `${command.label} with wholesale cookie`).toBe(401);
      expect(withWholesale.json()).toEqual({ error: "unauthorized" });
    }
  });
});
