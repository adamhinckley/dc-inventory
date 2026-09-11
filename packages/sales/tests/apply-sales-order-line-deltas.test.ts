import { describe, expect, it } from "vitest";
import { InMemoryCatalogProductPort } from "../src/adapters/in-memory-catalog-product-port.js";
import { ApplySalesOrderLineDeltasUseCase } from "../src/application/apply-sales-order-line-deltas.js";
import { InMemorySalesUnitOfWork } from "../src/adapters/in-memory-sales-unit-of-work.js";
import { CreateSalesOrderUseCase } from "../src/application/create-sales-order.js";
import { CustomerId, Money, OrganizationId } from "@dc-inventory/shared-kernel";
import {
  COVER_PRODUCT_ID,
  COVER_SKU,
  CUSTOMER_ID,
  DEFAULT_ORG,
  LOCK_PRODUCT_ID,
  LOCK_SKU,
  OPEN_PRODUCT_ID,
  OPEN_SKU,
  salesDemandHarness,
  WHOLESALE_USER_ID,
} from "./support/sales-demand-harness.js";
import { testShipBillToSnapshot, testShipCustomerTerms } from "./support/ship-invoice-readports.js";

function atpCatalog() {
  return new InMemoryCatalogProductPort([
    {
      productId: OPEN_PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: OPEN_SKU,
      name: "Open presell widget",
      unitPrice: Money.fromMinorUnits(500, "USD"),
      taxCategoryCode: "TANGIBLE",
      active: true,
    },
    {
      productId: LOCK_PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: LOCK_SKU,
      name: "Locked presell widget",
      unitPrice: Money.fromMinorUnits(700, "USD"),
      taxCategoryCode: "TANGIBLE",
      active: true,
      sellState: "locked",
      availableToSell: 5,
    },
    {
      productId: COVER_PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: COVER_SKU,
      name: "Cover presell widget",
      unitPrice: Money.fromMinorUnits(900, "USD"),
      taxCategoryCode: "TANGIBLE",
      active: true,
    },
  ]);
}

const customers = {
  findById: async (organizationId: OrganizationId, id: CustomerId) => {
    if (organizationId !== DEFAULT_ORG || id !== CUSTOMER_ID) {
      return null;
    }
    return { id, accountStatus: "active" as const };
  },
};

describe("ApplySalesOrderLineDeltasUseCase", () => {
  it("adds one SKU without requiring the client to send every existing line", async () => {
    const h = salesDemandHarness();

    const draft = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: OPEN_PRODUCT_ID, qty: 2 },
        { productId: LOCK_PRODUCT_ID, qty: 3 },
        { productId: COVER_PRODUCT_ID, qty: 4 },
      ],
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const apply = new ApplySalesOrderLineDeltasUseCase(
      h.uow.salesOrders,
      {
        findById: async (organizationId, id) => {
          if (organizationId !== DEFAULT_ORG || id !== CUSTOMER_ID) {
            return null;
          }
          return { id, accountStatus: "active" as const };
        },
      },
      h.catalog,
    );

    const result = await apply.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: draft.salesOrder.id,
      add: [{ productId: OPEN_PRODUCT_ID, qty: 5 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.salesOrder.lines).toHaveLength(3);
    expect(
      result.salesOrder.lines.find((line) => line.sku.value === "SALES-OPEN-1")?.qty,
    ).toBe(7);
    expect(
      result.salesOrder.lines.find((line) => line.sku.value === "SALES-LOCK-1")?.qty,
    ).toBe(3);
    expect(
      result.salesOrder.lines.find((line) => line.sku.value === "SALES-COVER-1")?.qty,
    ).toBe(4);
  });

  it("add increments qty when the sku is already on the draft", async () => {
    const h = salesDemandHarness();
    const created = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await h.applyLineDeltas.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrderId,
      add: [{ productId: OPEN_PRODUCT_ID, qty: 3 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.salesOrder.lines).toHaveLength(1);
    expect(result.salesOrder.lines[0]?.qty).toBe(5);
  });

  it("cancels the draft when the last line is removed", async () => {
    const h = salesDemandHarness();
    const created = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const order = await h.uow.salesOrders.findById(DEFAULT_ORG, created.salesOrderId);
    const lineId = order?.lines[0]?.id;
    expect(lineId).toBeDefined();

    const apply = new ApplySalesOrderLineDeltasUseCase(
      h.uow.salesOrders,
      {
        findById: async (organizationId, id) => {
          if (organizationId !== DEFAULT_ORG || id !== CUSTOMER_ID) {
            return null;
          }
          return { id, accountStatus: "active" as const };
        },
      },
      h.catalog,
    );

    const result = await apply.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrderId,
      remove: [lineId!],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.salesOrder.status).toBe("cancelled");
    expect(result.salesOrder.lines).toHaveLength(0);
    expect(result.salesOrder.cancelledAt).toBeInstanceOf(Date);
  });

  it("still ATP-gates locked increases", async () => {
    const catalog = atpCatalog();
    const uow = new InMemorySalesUnitOfWork(testShipBillToSnapshot, testShipCustomerTerms);
    const create = new CreateSalesOrderUseCase(uow.salesOrders, customers, catalog);
    const created = await create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: LOCK_PRODUCT_ID, qty: 1 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const apply = new ApplySalesOrderLineDeltasUseCase(uow.salesOrders, customers, catalog);

    const result = await apply.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      update: [{ sku: LOCK_SKU.value, qty: 9999 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("insufficient_atp");
  });

  it("does not load catalog qty when every remaining line is the same qty or less", async () => {
    const h = salesDemandHarness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: OPEN_PRODUCT_ID, qty: 4 },
        { productId: LOCK_PRODUCT_ID, qty: 2 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    let qtyLoads = 0;
    const catalog = {
      findById: h.catalog.findById.bind(h.catalog),
      findBySku: h.catalog.findBySku.bind(h.catalog),
      findByIds: async (
        organizationId: typeof DEFAULT_ORG,
        productIds: Parameters<typeof h.catalog.findByIds>[1],
        options?: Parameters<typeof h.catalog.findByIds>[2],
      ) => {
        if (options?.includeQty !== false) {
          qtyLoads += 1;
        }
        return h.catalog.findByIds(organizationId, productIds, options);
      },
    };
    const apply = new ApplySalesOrderLineDeltasUseCase(
      h.uow.salesOrders,
      {
        findById: async (organizationId, id) => {
          if (organizationId !== DEFAULT_ORG || id !== CUSTOMER_ID) {
            return null;
          }
          return { id, accountStatus: "active" as const };
        },
      },
      catalog,
    );

    const dropped = await apply.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      remove: ["SALES-LOCK-1"],
    });
    expect(dropped.ok).toBe(true);
    expect(qtyLoads).toBe(0);
  });

  it("applies add and remove in one body atomically", async () => {
    const h = salesDemandHarness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: OPEN_PRODUCT_ID, qty: 2 },
        { productId: LOCK_PRODUCT_ID, qty: 1 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const lockLineId = created.salesOrder.lines.find((line) => line.sku.value === "SALES-LOCK-1")
      ?.id;
    expect(lockLineId).toBeDefined();

    const apply = new ApplySalesOrderLineDeltasUseCase(
      h.uow.salesOrders,
      {
        findById: async (organizationId, id) => {
          if (organizationId !== DEFAULT_ORG || id !== CUSTOMER_ID) {
            return null;
          }
          return { id, accountStatus: "active" as const };
        },
      },
      h.catalog,
    );

    const result = await apply.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      remove: [lockLineId!],
      add: [{ productId: COVER_PRODUCT_ID, qty: 3 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.salesOrder.lines).toHaveLength(2);
    expect(result.salesOrder.lines.some((line) => line.sku.value === "SALES-LOCK-1")).toBe(false);
    expect(
      result.salesOrder.lines.find((line) => line.sku.value === "SALES-COVER-1")?.qty,
    ).toBe(3);
    expect(
      result.salesOrder.lines.find((line) => line.sku.value === "SALES-OPEN-1")?.qty,
    ).toBe(2);
  });

  it("rolls back when a later delta in the same body fails ATP", async () => {
    const catalog = atpCatalog();
    const uow = new InMemorySalesUnitOfWork(testShipBillToSnapshot, testShipCustomerTerms);
    const create = new CreateSalesOrderUseCase(uow.salesOrders, customers, catalog);
    const apply = new ApplySalesOrderLineDeltasUseCase(uow.salesOrders, customers, catalog);
    const created = await create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 1 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const before = await uow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(before?.lines).toHaveLength(1);

    const result = await apply.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      add: [{ productId: LOCK_PRODUCT_ID, qty: 1 }],
      update: [{ sku: LOCK_SKU.value, qty: 9999 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("insufficient_atp");

    const after = await uow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(after?.lines).toHaveLength(1);
    expect(after?.lines[0]?.sku.value).toBe(OPEN_SKU.value);
  });
});
