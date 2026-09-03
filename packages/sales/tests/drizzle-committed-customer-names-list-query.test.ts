import {
  CustomerId,
  OrderId,
  OrganizationId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { createCommittedCustomerNamesSqlEvaluator } from "./support/evaluate-committed-customer-names-sql.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const SKU_A = Sku.parse("SHORT-A");
const SKU_B = Sku.parse("SHORT-B");
const CUSTOMER_A = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const CUSTOMER_B = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const ORDER_A = OrderId.parse("22222222-2222-4222-8222-222222222222");
const ORDER_B = OrderId.parse("33333333-3333-4333-8333-333333333333");

describe("buildCommittedCustomerNamesQuery", () => {
  it("returns distinct customer names for confirmed orders on requested SKUs", async () => {
    const evaluator = await createCommittedCustomerNamesSqlEvaluator();
    try {
      const result = await evaluator.list([SKU_A], [
        {
          customerId: CUSTOMER_A,
          customerName: "Alpha Co",
          orderId: ORDER_A,
          status: "confirmed",
          sku: SKU_A.value,
        },
        {
          customerId: CUSTOMER_B,
          customerName: "Beta Co",
          orderId: ORDER_B,
          status: "confirmed",
          sku: SKU_B.value,
        },
      ]);

      expect(result).toEqual([{ customerId: CUSTOMER_A, name: "Alpha Co" }]);
    } finally {
      await evaluator.close();
    }
  });

  it("omits customers when the only matching order is not confirmed", async () => {
    const evaluator = await createCommittedCustomerNamesSqlEvaluator();
    try {
      const result = await evaluator.list([SKU_A], [
        {
          customerId: CUSTOMER_A,
          customerName: "Alpha Co",
          orderId: ORDER_A,
          status: "draft",
          sku: SKU_A.value,
        },
      ]);

      expect(result).toEqual([]);
    } finally {
      await evaluator.close();
    }
  });

  it("returns empty when no SKUs are requested", async () => {
    const evaluator = await createCommittedCustomerNamesSqlEvaluator();
    try {
      const result = await evaluator.list([], [
        {
          customerId: CUSTOMER_A,
          customerName: "Alpha Co",
          orderId: ORDER_A,
          status: "confirmed",
          sku: SKU_A.value,
        },
      ]);

      expect(result).toEqual([]);
    } finally {
      await evaluator.close();
    }
  });
});
