import { afterEach, describe, expect, it, vi } from "vitest";
import { customFetch, WholesaleHttpError } from "./custom-fetch";

describe("customFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws on HTTP errors instead of resolving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: "insufficient_atp",
            name: "Locked presell widget",
            requestedQty: 401,
            availableQty: 400,
          },
          { status: 409 },
        ),
      ),
    );

    const error = await customFetch("/wholesale/sales-orders/abc/confirm", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "k" }),
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(WholesaleHttpError);
    expect(error).toMatchObject({
      message: expect.stringContaining("HTTP 409"),
      status: 409,
      data: {
        error: "insufficient_atp",
        name: "Locked presell widget",
        requestedQty: 401,
        availableQty: 400,
      },
    });
  });
});
