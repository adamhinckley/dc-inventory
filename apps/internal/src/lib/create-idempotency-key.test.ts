import { afterEach, describe, expect, it, vi } from "vitest";
import { createIdempotencyKey } from "./create-idempotency-key";

describe("createIdempotencyKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mints a v4 uuid from getRandomValues when randomUUID is missing", () => {
    vi.stubGlobal("crypto", {
      getRandomValues(target: Uint8Array) {
        target.set(
          Uint8Array.from([
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa,
            0xbb, 0xcc, 0xdd, 0xee, 0xff,
          ]),
        );
        return target;
      },
    });

    expect(createIdempotencyKey()).toBe("00112233-4455-4677-8899-aabbccddeeff");
  });
});
