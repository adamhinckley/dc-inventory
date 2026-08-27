import { describe, expect, it } from "vitest";
import { allocateInstant } from "./allocate-instant.js";

const CREATED = new Date("2026-02-25T00:00:00.000Z");
const SHIPPED_EARLIER = new Date("2025-12-04T00:00:00.000Z");

describe("allocateInstant", () => {
  it("keeps leftover confirmed allocations on the sales-order instant", () => {
    expect(allocateInstant(CREATED, SHIPPED_EARLIER, false).getTime()).toBe(CREATED.getTime());
  });

  it("pins shipped allocations to min(create, ship) so Idle Park aging cannot ship first", () => {
    expect(allocateInstant(CREATED, SHIPPED_EARLIER, true).getTime()).toBe(
      SHIPPED_EARLIER.getTime(),
    );
  });
});
