import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHART_SERIES_COLORS } from "../src/chart-tokens";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("Recharts stub tokens", () => {
  it("uses Okabe–Ito CSS variables, not raw hex", () => {
    expect(CHART_SERIES_COLORS).toEqual([
      "var(--color-chart-01)",
      "var(--color-chart-02)",
      "var(--color-chart-03)",
      "var(--color-chart-04)",
      "var(--color-chart-05)",
      "var(--color-chart-06)",
      "var(--color-chart-07)",
      "var(--color-chart-08)",
    ]);
    for (const token of CHART_SERIES_COLORS) {
      expect(token).not.toMatch(/#/);
    }
  });

  it("does not hardcode hex in the chart wrapper", () => {
    const source = readFileSync(join(srcDir, "report-chart.tsx"), "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(source).toContain("recharts");
    expect(source).toContain("CHART_SERIES_COLORS");
  });
});
