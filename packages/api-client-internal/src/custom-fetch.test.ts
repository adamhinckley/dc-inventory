import { afterEach, describe, expect, it, vi } from "vitest";
import { customFetch } from "./custom-fetch";

describe("customFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON and status on HTTP errors instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "insufficient_atp" }, { status: 409 }),
      ),
    );

    const result = await customFetch<{ data: { error: string }; status: number }>(
      "/internal/sales-orders/abc/confirm",
      { method: "POST", body: JSON.stringify({ idempotencyKey: "k" }) },
    );

    expect(result.status).toBe(409);
    expect(result.data).toEqual({ error: "insufficient_atp" });
  });
});
