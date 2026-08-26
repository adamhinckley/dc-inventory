import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("folder-per-surface layout", () => {
  it("does not keep flat public modules at src root", () => {
    expect(existsSync(join(srcDir, "data-table.tsx"))).toBe(false);
    expect(existsSync(join(srcDir, "report-chart.tsx"))).toBe(false);
    expect(existsSync(join(srcDir, "list-params.ts"))).toBe(false);
    expect(existsSync(join(srcDir, "table-meta.ts"))).toBe(false);
    expect(existsSync(join(srcDir, "chart-tokens.ts"))).toBe(false);
    expect(existsSync(join(srcDir, "charts/bar"))).toBe(false);
    expect(existsSync(join(srcDir, "charts/pie"))).toBe(false);
  });

  it("ships data-table and report-chart folders", () => {
    expect(existsSync(join(srcDir, "data-table/data-table.tsx"))).toBe(true);
    expect(existsSync(join(srcDir, "data-table/use-data-table.ts"))).toBe(true);
    expect(existsSync(join(srcDir, "data-table/index.ts"))).toBe(true);
    expect(
      existsSync(join(srcDir, "charts/report-chart/report-chart.tsx")),
    ).toBe(true);
    expect(existsSync(join(srcDir, "charts/report-chart/chart-tokens.ts"))).toBe(
      true,
    );
  });

  it("keeps package src/index.ts as re-exports only", () => {
    const text = readFileSync(join(srcDir, "index.ts"), "utf8");
    expect(text).toMatch(/^export /);
    expect(text).not.toMatch(/\bfunction\b/);
    expect(text).not.toMatch(/\bconst\b/);
    expect(text).not.toMatch(/\bclass\b/);
  });

  it("does not add empty extra chart type folders", () => {
    const charts = readdirSync(join(srcDir, "charts"));
    expect(charts).toEqual(["report-chart"]);
  });

  it("scopes form-control IDs per Root instance", () => {
    const source = readFileSync(join(srcDir, "data-table/data-table.tsx"), "utf8");
    expect(source).toContain("idBase");
    expect(source).toContain("tableControlIdBase");
    expect(source).not.toContain("useId");
    expect(source).not.toMatch(/id="datatable-search"/);
    expect(source).not.toMatch(/id="datatable-sort"/);
    expect(source).toContain("aria-sort");
    expect(source).not.toMatch(/<Label htmlFor=\{sortId\}>Sort<\/Label>/);
  });
});
