import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryDatabase } from "../adapters/in-memory-database.js";
import { MissingDatabaseUrlError } from "../infrastructure/database-url.js";
import { ReadyCheckUseCase } from "./ready.js";

const srcRoot = resolve(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(srcRoot, relativePath), "utf8");
}

describe("ReadyCheckUseCase (in-memory database)", () => {
  it("returns ready when ping succeeds", async () => {
    const useCase = new ReadyCheckUseCase(new InMemoryDatabase());
    await expect(useCase.execute()).resolves.toEqual({ ready: true });
  });

  it("returns a public error when ping fails", async () => {
    const useCase = new ReadyCheckUseCase(
      new InMemoryDatabase({ failWith: new Error("connection refused") }),
    );
    await expect(useCase.execute()).resolves.toEqual({
      ready: false,
      error: "connection refused",
    });
  });

  it("keeps the missing-URL message and redacts connection strings", async () => {
    const missing = new ReadyCheckUseCase(
      new InMemoryDatabase({ failWith: new MissingDatabaseUrlError() }),
    );
    await expect(missing.execute()).resolves.toEqual({
      ready: false,
      error: new MissingDatabaseUrlError().message,
    });

    const leaked = new ReadyCheckUseCase(
      new InMemoryDatabase({
        failWith: new Error(
          "connect failed postgres://user:secret@localhost:5432/dc_inventory",
        ),
      }),
    );
    const result = await leaked.execute();
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.error).toContain("[redacted-url]");
      expect(result.error).not.toContain("secret");
    }
  });

  it("does not import Fastify, Pino, Zod, Drizzle, or postgres.js", () => {
    const source = readSrc("application/ready.ts");
    expect(source).not.toMatch(
      /fastify|pino|zod|drizzle|postgres|better-auth/i,
    );
    expect(source).toContain("../domain/database.js");
    expect(source).not.toContain("../infrastructure/");
  });
});
