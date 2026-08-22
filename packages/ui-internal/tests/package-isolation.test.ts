import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("ui-internal package layout", () => {
  it("keeps public surfaces in folders and the package barrel as re-exports", () => {
    expect(existsSync(join(srcRoot, "data-table/index.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "data-table/data-table.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "data-table/use-data-table.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "charts/report-chart/index.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "data-table.tsx"))).toBe(false);
    expect(existsSync(join(srcRoot, "report-chart.tsx"))).toBe(false);
    expect(existsSync(join(srcRoot, "charts/bar"))).toBe(false);
    expect(existsSync(join(srcRoot, "charts/pie"))).toBe(false);

    const barrel = readFileSync(join(srcRoot, "index.ts"), "utf8");
    expect(barrel).toMatch(/^export /m);
    expect(barrel).not.toMatch(/function /);
    expect(barrel).not.toMatch(/useState/);
  });

  it("does not import Next navigation, Orval clients, or hand-written fetch", () => {
    const sources = walk(srcRoot);
    expect(sources.length).toBeGreaterThan(0);

    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      const imports = text
        .split("\n")
        .filter((line) => /^\s*import\s/.test(line))
        .join("\n");
      expect(imports, file).not.toMatch(/next\/navigation/);
      expect(imports, file).not.toMatch(/\buseSearchParams\b/);
      expect(imports, file).not.toMatch(/\buseRouter\b/);
      expect(imports, file).not.toMatch(/@dc-inventory\/api-client-internal/);
      expect(text, file).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
