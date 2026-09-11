import { OrderId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  listFifoUncoveredCommittedOrders,
  netOrderCommittedQuantity,
  netOrderCoverQuantity,
  type OrderCoverMovement,
} from "../src/domain/order-cover.js";

const SO_A = OrderId.parse("550e8400-e29b-41d4-a716-446655440070");
const SO_B = OrderId.parse("550e8400-e29b-41d4-a716-446655440071");

function movement(
  movementType: OrderCoverMovement["movementType"],
  quantity: number,
  refId: string,
  createdAt: Date,
): OrderCoverMovement {
  return {
    movementType,
    quantity,
    refType: "sales_order",
    refId,
    createdAt,
  };
}

describe("order-cover (ADA-256)", () => {
  it("computes net committed and cover per sales order ref", () => {
    const movements = [
      movement("Committed", 400, SO_A, new Date("2026-06-15T09:00:00.000Z")),
      movement("Decommitted", 50, SO_A, new Date("2026-06-15T09:30:00.000Z")),
      movement("Allocated", 100, SO_A, new Date("2026-06-15T10:00:00.000Z")),
      movement("Deallocated", 25, SO_A, new Date("2026-06-15T10:30:00.000Z")),
    ];

    expect(netOrderCommittedQuantity(movements, SO_A)).toBe(350);
    expect(netOrderCoverQuantity(movements, SO_A)).toBe(75);
  });

  it("lists toOrder committed orders FIFO by first commit time", () => {
    const movements = [
      movement("Committed", 400, SO_B, new Date("2026-06-15T10:00:00.000Z")),
      movement("Committed", 500, SO_A, new Date("2026-06-15T09:00:00.000Z")),
      movement("Allocated", 100, SO_A, new Date("2026-06-15T09:30:00.000Z")),
    ];

    expect(listFifoUncoveredCommittedOrders(movements)).toEqual([
      { orderId: SO_A, uncoveredQty: 400 },
      { orderId: SO_B, uncoveredQty: 400 },
    ]);
  });
});
