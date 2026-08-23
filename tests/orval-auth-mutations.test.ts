import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("Orval auth hooks (ADA-77)", () => {
  it("does not set global useQuery: true (that turns POST login/logout into queries)", () => {
    const config = readFileSync(resolve(root, "orval.config.ts"), "utf8").replace(
      /\/\/.*$/gm,
      "",
    );
    expect(config).not.toMatch(/useQuery:\s*true/);
  });
});
