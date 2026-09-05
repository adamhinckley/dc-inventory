import { afterEach, describe, expect, it, vi } from "vitest";
import { customFetch } from "./custom-fetch";

describe("customFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws on HTTP errors instead of resolving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "unauthorized" }, { status: 401 })),
    );

    await expect(
      customFetch("/ops/example", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    ).rejects.toThrow("HTTP 401");
  });
});
