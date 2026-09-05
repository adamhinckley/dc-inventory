import { afterEach, describe, expect, it, vi } from "vitest";
import { customFetch } from "./custom-fetch";

describe("customFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws on HTTP errors instead of resolving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "insufficient_atp" }, { status: 409 }),
      ),
    );

    await expect(
      customFetch("/wholesale/sales-orders/abc/confirm", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: "k" }),
      }),
    ).rejects.toThrow("HTTP 409");
  });
});
