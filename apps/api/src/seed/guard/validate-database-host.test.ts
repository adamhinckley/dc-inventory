import { describe, expect, it } from "vitest";
import { DemoSeedGuardError } from "./errors.js";
import { assertLocalDatabaseHost } from "./validate-database-host.js";

describe("assertLocalDatabaseHost", () => {
  it.each([
    ["localhost"],
    ["127.0.0.1"],
    ["postgres"],
  ] as const)("accepts the local host %s", (host) => {
    expect(() =>
      assertLocalDatabaseHost(`postgres://user:pass@${host}:5432/dc_inventory`),
    ).not.toThrow();
    expect(() =>
      assertLocalDatabaseHost(`postgresql://user:pass@${host}/dc_inventory`),
    ).not.toThrow();
  });

  it("accepts IPv6 loopback URLs", () => {
    expect(() =>
      assertLocalDatabaseHost("postgres://user:pass@[::1]:5432/dc_inventory"),
    ).not.toThrow();
  });

  it("rejects missing, blank, malformed, and remote database URLs", () => {
    expect(() => assertLocalDatabaseHost("")).toThrow(DemoSeedGuardError);
    expect(() => assertLocalDatabaseHost("   ")).toThrow(/DATABASE_URL is missing/);

    expect(() => assertLocalDatabaseHost("not-a-url")).toThrow(/malformed/);
    expect(() => assertLocalDatabaseHost("mysql://localhost/demo")).toThrow(
      /postgres:\/\/ or postgresql:\/\//,
    );

    expect(() =>
      assertLocalDatabaseHost("postgres://user:pass@db.example.com:5432/demo"),
    ).toThrow(/not allowed/);
    expect(() =>
      assertLocalDatabaseHost("postgres://user:pass@neon.tech/demo"),
    ).toThrow(/not allowed/);
  });
});
