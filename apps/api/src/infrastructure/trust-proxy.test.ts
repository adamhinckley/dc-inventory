import { describe, expect, it } from "vitest";
import { readTrustProxy } from "./trust-proxy.js";

describe("readTrustProxy", () => {
  it("defaults to false when unset", () => {
    expect(readTrustProxy(undefined)).toBe(false);
    expect(readTrustProxy("")).toBe(false);
  });

  it("parses boolean and subnet values", () => {
    expect(readTrustProxy("true")).toBe(true);
    expect(readTrustProxy("1")).toBe(true);
    expect(readTrustProxy("false")).toBe(false);
    expect(readTrustProxy("0")).toBe(false);
    expect(readTrustProxy("127.0.0.1,10.0.0.0/8")).toBe("127.0.0.1,10.0.0.0/8");
  });
});
