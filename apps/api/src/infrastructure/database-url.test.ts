import { describe, expect, it } from "vitest";
import {
  InvalidDatabaseTargetError,
  MissingDatabaseUrlError,
  MissingNeonDatabaseUrlError,
  PooledDatabaseUrlError,
  readDatabaseUrl,
} from "./database-url.js";

const localUrl = "postgres://postgres:postgres@localhost:5432/dc_inventory";
const neonDirect = "postgresql://owner:secret@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require";
const neonPooled =
  "postgresql://owner:secret@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";

describe("readDatabaseUrl", () => {
  it("fails clearly when DATABASE_URL is missing or blank", () => {
    expect(() => readDatabaseUrl({})).toThrow(MissingDatabaseUrlError);
    expect(() => readDatabaseUrl({ DATABASE_URL: "   " })).toThrow(
      /DATABASE_URL is missing/,
    );
    expect(() => readDatabaseUrl({ DATABASE_URL: "   " })).toThrow(
      /apps\/api\/README.md/,
    );
  });

  it("returns the trimmed URL when set", () => {
    expect(
      readDatabaseUrl({ DATABASE_URL: "  postgres://localhost/dc_inventory  " }),
    ).toBe("postgres://localhost/dc_inventory");
  });

  it("uses DATABASE_URL_NEON when DATABASE_TARGET is neon", () => {
    expect(
      readDatabaseUrl({
        DATABASE_TARGET: "neon",
        DATABASE_URL: localUrl,
        DATABASE_URL_NEON: `  ${neonDirect}  `,
        DATABASE_URL_UNPOOLED: neonPooled,
      }),
    ).toBe(neonDirect);
  });

  it("falls back to DATABASE_URL_UNPOOLED when neon is selected and DATABASE_URL_NEON is blank", () => {
    expect(
      readDatabaseUrl({
        DATABASE_TARGET: " neon ",
        DATABASE_URL_UNPOOLED: `  ${neonDirect}  `,
      }),
    ).toBe(neonDirect);
  });

  it("fails clearly when neon is selected without a Neon URL", () => {
    expect(() =>
      readDatabaseUrl({ DATABASE_TARGET: "neon", DATABASE_URL: localUrl }),
    ).toThrow(MissingNeonDatabaseUrlError);
    expect(() =>
      readDatabaseUrl({ DATABASE_TARGET: "neon", DATABASE_URL: localUrl }),
    ).toThrow(/DATABASE_URL_NEON is missing/);
  });

  it("uses DATABASE_URL_LOCAL when DATABASE_TARGET is local", () => {
    expect(
      readDatabaseUrl({
        DATABASE_TARGET: "local",
        DATABASE_URL: neonPooled,
        DATABASE_URL_LOCAL: `  ${localUrl}  `,
      }),
    ).toBe(localUrl);
  });

  it("rejects an unknown DATABASE_TARGET", () => {
    expect(() =>
      readDatabaseUrl({ DATABASE_TARGET: "staging", DATABASE_URL: localUrl }),
    ).toThrow(InvalidDatabaseTargetError);
    expect(() =>
      readDatabaseUrl({ DATABASE_TARGET: "staging", DATABASE_URL: localUrl }),
    ).toThrow(/local, neon/);
  });

  it("rejects pooled Neon hostnames when DATABASE_TARGET is unset", () => {
    expect(() => readDatabaseUrl({ DATABASE_URL: neonPooled })).toThrow(
      PooledDatabaseUrlError,
    );
    expect(() => readDatabaseUrl({ DATABASE_URL: neonPooled })).toThrow(
      /-pooler/,
    );
  });

  it("rejects pooled Neon hostnames when DATABASE_TARGET is neon", () => {
    expect(() =>
      readDatabaseUrl({
        DATABASE_TARGET: "neon",
        DATABASE_URL_UNPOOLED: neonPooled,
      }),
    ).toThrow(PooledDatabaseUrlError);
  });

  it("rejects pooled Neon hostnames when DATABASE_TARGET is local", () => {
    expect(() =>
      readDatabaseUrl({
        DATABASE_TARGET: "local",
        DATABASE_URL_LOCAL: neonPooled,
      }),
    ).toThrow(PooledDatabaseUrlError);
  });
});
