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

  it("keeps the database failure internal when ping fails", async () => {
    const cause = new Error("connection refused");
    const useCase = new ReadyCheckUseCase(
      new InMemoryDatabase({ failWith: cause }),
    );
    await expect(useCase.execute()).resolves.toEqual({
      ready: false,
      cause,
    });
  });

  it("returns missing configuration as an internal cause", async () => {
    const cause = new MissingDatabaseUrlError();
    const missing = new ReadyCheckUseCase(
      new InMemoryDatabase({ failWith: cause }),
    );
    await expect(missing.execute()).resolves.toEqual({
      ready: false,
      cause,
    });
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
