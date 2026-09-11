import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { exportOpenApiYaml } from "./export-openapi.js";

type OpenApiParameter = {
  in: string;
  name: string;
  schema: {
    default?: unknown;
    enum?: string[];
  };
};

type TableOperation = {
  operationId: string;
  parameters?: OpenApiParameter[];
  responses: Record<string, unknown>;
  "x-table": {
    search?: { param: string };
    filters?: Array<{ param: string; rangePair?: string }>;
    sort?: {
      defaultBy: string;
      defaultOrder: "asc" | "desc";
      fields: string[];
    };
  };
};

describe("OpenAPI stub export", () => {
  it("emits three audience specs with the required stub operations", async () => {
    const specs = await exportOpenApiYaml();

    expect(specs.internal).toContain("/internal/products");
    expect(specs.internal).toContain("/internal/auth/login");
    expect(specs.internal).toContain("/internal/customers");
    expect(specs.internal).toContain("listInternalCustomers");
    expect(specs.internal).toContain("x-table");
    expect(specs.internal).toContain("listInternalProducts");
    expect(specs.internal).toContain("getInternalCustomerAccounting");
    expect(specs.internal).toContain("getInternalCustomerAccountingWorkspace");
    expect(specs.internal).toContain("listInternalCustomerInvoices");
    expect(specs.internal).toContain("listInternalCustomerPayments");
    expect(specs.internal).toContain("recordInternalCustomerPayment");
    expect(specs.internal).toContain("reallocateInternalPayment");
    expect(specs.internal).toContain("voidInternalPayment");
    expect(specs.internal).toContain("adjustInternalInvoice");
    expect(specs.internal).toContain("setInternalCustomerPaymentPlan");
    expect(specs.internal).toContain("endInternalCustomerPaymentPlan");
    expect(specs.internal).toContain("getInternalAccountingSummary");
    expect(specs.internal).toContain("listInternalAccountingCustomerBalances");
    expect(specs.internal).toContain("listInternalAccountingPayments");
    expect(specs.internal).toContain("draftInternalPreOrderPurchaseOrders");
    expect(specs.internal).toContain("/internal/pre-order-skus/draft-purchase-orders");
    expect(specs.internal).toContain("/internal/purchase-orders/sync-from-pre-order");
    expect(specs.internal).not.toMatch(/uncovered/i);
    expect(specs.internal).not.toContain("/ops/auth/");

    expect(specs.wholesale).toContain("/wholesale/catalog");
    expect(specs.wholesale).toContain("/wholesale/auth/login");
    expect(specs.wholesale).toContain("listWholesaleCatalog");
    expect(specs.wholesale).not.toContain("x-table");
    expect(specs.wholesale).not.toContain("/internal/");

    expect(specs.ops).toContain("/ops/subscription");
    expect(specs.ops).toContain("/ops/auth/login");
    expect(specs.ops).toContain("loginOps");
    expect(specs.ops).not.toContain("/internal/");
    expect(specs.ops).not.toContain("x-table");
  });

  it("keeps internal list parameters aligned with x-table declarations", async () => {
    const specs = await exportOpenApiYaml();
    const internal = parse(specs.internal) as {
      paths: Record<string, { get?: TableOperation }>;
    };
    const tableOperations = Object.values(internal.paths)
      .map((path) => path.get)
      .filter((operation): operation is TableOperation => operation?.["x-table"] !== undefined);

    expect(tableOperations.map((operation) => operation.operationId).sort()).toEqual([
      "listInternalAccountingCustomerBalances",
      "listInternalAccountingPayments",
      "listInternalCustomers",
      "listInternalPreOrderFactories",
      "listInternalPreOrderSkus",
      "listInternalProducts",
      "listInternalPurchaseOrders",
      "listInternalSalesOrders",
      "listInternalSellWindows",
      "listInternalSupplierProducts",
      "listInternalSuppliers",
    ]);

    for (const operation of tableOperations) {
      const queryParameters = (operation.parameters ?? []).filter(
        (parameter) => parameter.in === "query",
      );
      const byName = new Map(queryParameters.map((parameter) => [parameter.name, parameter]));
      const table = operation["x-table"];
      const paginationOnly = table.sort === undefined;
      const sharedParams = [
        ...(table.search === undefined ? [] : ["q"]),
        "page",
        "pageSize",
        "sortBy",
        "sortOrder",
      ];

      if (paginationOnly) {
        expect([...byName.keys()], operation.operationId).toEqual(
          expect.arrayContaining(["page", "pageSize"]),
        );
        expect(byName.get("page")?.schema.default, operation.operationId).toBe(1);
        expect(byName.get("pageSize")?.schema.default, operation.operationId).toBe(25);
        expect(operation.responses["400"], operation.operationId).toBeDefined();
        continue;
      }

      expect([...byName.keys()], operation.operationId).toEqual(
        expect.arrayContaining(sharedParams),
      );

      if (table.search !== undefined) {
        expect(table.search.param, operation.operationId).toBe("q");
      }
      expect(byName.get("page")?.schema.default, operation.operationId).toBe(1);
      expect(byName.get("pageSize")?.schema.default, operation.operationId).toBe(25);
      expect(byName.get("sortBy")?.schema.enum, operation.operationId).toEqual(
        table.sort.fields,
      );
      expect(byName.get("sortBy")?.schema.default, operation.operationId).toBe(
        table.sort.defaultBy,
      );
      expect(byName.get("sortOrder")?.schema.enum, operation.operationId).toEqual([
        "asc",
        "desc",
      ]);
      expect(byName.get("sortOrder")?.schema.default, operation.operationId).toBe(
        table.sort.defaultOrder,
      );

      const declaredFilters = (table.filters ?? []).flatMap((filter) =>
        filter.rangePair === undefined
          ? [filter.param]
          : [filter.param, filter.rangePair],
      );
      const acceptedFilters = queryParameters
        .map((parameter) => parameter.name)
        .filter((name) => !sharedParams.includes(name));
      expect(declaredFilters.sort(), operation.operationId).toEqual(
        acceptedFilters.sort(),
      );
      expect(operation.responses["400"], operation.operationId).toBeDefined();
    }
  });
});
