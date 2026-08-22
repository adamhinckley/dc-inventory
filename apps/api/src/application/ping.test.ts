import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../adapters/in-memory-clock.js";
import { PingUseCase } from "./ping.js";

const srcRoot = resolve(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(srcRoot, relativePath), "utf8");
}

describe("PingUseCase (in-memory clock)", () => {
  it("returns ok and the clock instant", () => {
    const at = new Date("2026-08-22T03:00:00.000Z");
    const useCase = new PingUseCase(new InMemoryClock(at));

    expect(useCase.execute()).toEqual({ ok: true, at });
  });

  it("does not import Fastify, Pino, Zod, or other adapter SDKs", () => {
    const source = readSrc("application/ping.ts");
    expect(source).not.toMatch(/fastify|pino|zod|drizzle|better-auth/i);
    expect(source).toContain("../domain/clock.js");
  });
});
