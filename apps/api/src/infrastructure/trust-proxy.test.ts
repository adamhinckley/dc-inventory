import { describe, expect, it } from "vitest";
import { readTrustProxy, trustProxyHopCount } from "./trust-proxy.js";

describe("readTrustProxy", () => {
  it("defaults to false when unset", () => {
    expect(readTrustProxy(undefined)).toBe(false);
    expect(readTrustProxy("")).toBe(false);
  });

  it("parses boolean and subnet values", () => {
    expect(readTrustProxy("true")).toBe(true);
    expect(readTrustProxy("false")).toBe(false);
    expect(readTrustProxy("0")).toBe(false);
    expect(readTrustProxy("127.0.0.1,10.0.0.0/8")).toBe("127.0.0.1,10.0.0.0/8");
  });

  it("parses positive integers as hop-count trust functions", () => {
    const oneHop = readTrustProxy("1");
    expect(typeof oneHop).toBe("function");
    expect((oneHop as ReturnType<typeof trustProxyHopCount>)("127.0.0.1", 0)).toBe(true);
    expect((oneHop as ReturnType<typeof trustProxyHopCount>)("127.0.0.1", 1)).toBe(false);

    const twoHop = readTrustProxy("2");
    expect((twoHop as ReturnType<typeof trustProxyHopCount>)("127.0.0.1", 1)).toBe(true);
    expect((twoHop as ReturnType<typeof trustProxyHopCount>)("127.0.0.1", 2)).toBe(false);
  });
});
