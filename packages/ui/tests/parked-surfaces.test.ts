import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("ADR 0006 parked Table surface", () => {
  it("is on the public @dc-inventory/ui barrel for local editors", () => {
    const barrel = readFileSync(join(pkgRoot, "src/index.ts"), "utf8");
    expect(barrel).toMatch(/ui\/Table/);
    expect(barrel).toMatch(/\buseTable\b/);
  });

  it("is excluded from package typecheck", () => {
    const tsconfig = JSON.parse(
      readFileSync(join(pkgRoot, "tsconfig.json"), "utf8"),
    ) as { exclude: string[] };
    expect(tsconfig.exclude).toContain("src/ui/Table/**");
  });

  it("is excluded from Storybook so agents do not copy it", () => {
    const main = readFileSync(join(repoRoot, ".storybook/main.ts"), "utf8");
    expect(main).toMatch(/!.*packages\/ui\/src\/ui\/Table/);
  });
});
