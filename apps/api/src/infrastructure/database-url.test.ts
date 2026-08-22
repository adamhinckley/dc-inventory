import { describe, expect, it } from "vitest";
import {
  MissingDatabaseUrlError,
  readDatabaseUrl,
} from "./database-url.js";

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
});
