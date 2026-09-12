import { afterEach, describe, expect, it, vi } from "vitest";
import { resetDraftCreateGate, runExclusiveDraftCreate } from "./cart-create-gate";
import type { WholesaleDraftCartOrder } from "./wholesale-cart-cache";

function draft(id: string): WholesaleDraftCartOrder {
  return {
    id,
    customerId: "cust-1",
    documentNumber: "SO-0001",
    status: "draft",
    lines: [],
  };
}

describe("cart-create-gate", () => {
  afterEach(() => {
    resetDraftCreateGate();
  });

  it("shares one in-flight create across concurrent callers", async () => {
    const create = vi.fn(async () => draft("draft-1"));
    const [first, second] = await Promise.all([
      runExclusiveDraftCreate(create),
      runExclusiveDraftCreate(create),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(first).toEqual(draft("draft-1"));
    expect(second).toEqual(draft("draft-1"));
  });

  it("allows a new create after the previous one settles", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(draft("draft-1"))
      .mockResolvedValueOnce(draft("draft-2"));
    expect(await runExclusiveDraftCreate(create)).toEqual(draft("draft-1"));
    expect(await runExclusiveDraftCreate(create)).toEqual(draft("draft-2"));
    expect(create).toHaveBeenCalledTimes(2);
  });
});
