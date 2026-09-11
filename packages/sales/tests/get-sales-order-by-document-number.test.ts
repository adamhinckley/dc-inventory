import {
  CustomerId,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemorySalesOrderRepository } from "../src/adapters/in-memory-sales-order-repository.js";
import { GetSalesOrderByDocumentNumberUseCase } from "../src/application/get-sales-order-by-document-number.js";
import type { SalesOrder } from "../src/domain/sales-order.js";

const ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const ORDER_ID = OrderId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

function sampleOrder(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: ORDER_ID,
    organizationId: ORG,
    customerId: CUSTOMER_ID,
    documentNumber: "SO-00001",
    status: "confirmed",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    lines: [],
    ...overrides,
  };
}

describe("GetSalesOrderByDocumentNumberUseCase", () => {
  it("returns the order when document number exists", async () => {
    const repo = new InMemorySalesOrderRepository();
    const order = sampleOrder();
    await repo.save(order);

    const useCase = new GetSalesOrderByDocumentNumberUseCase(repo);
    const result = await useCase.execute({
      organizationId: ORG,
      staffUserId: STAFF_ID,
      documentNumber: "SO-00001",
    });

    expect(result).toEqual({ ok: true, salesOrder: order });
  });

  it("returns not_found when document number is missing", async () => {
    const useCase = new GetSalesOrderByDocumentNumberUseCase(
      new InMemorySalesOrderRepository(),
    );
    const result = await useCase.execute({
      organizationId: ORG,
      staffUserId: STAFF_ID,
      documentNumber: "SO-99999",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
