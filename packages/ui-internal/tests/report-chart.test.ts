import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHART_SERIES_COLORS } from "../src/chart-tokens";
import { formatChartY, toWideRows } from "../src/report-chart-data";

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

describe("formatChartY", () => {
  it("formats integer cents at the display edge", () => {
    expect(formatChartY(1234, "cents")).toBe("$12.34");
  });

  it("leaves count and quantity as integers", () => {
    expect(formatChartY(48, "count")).toBe("48");
    expect(formatChartY(48, "quantity")).toBe("48");
  });
});

describe("toWideRows", () => {
  it("sorts x values so mixed series order is deterministic", () => {
    const rows = toWideRows([
      {
        name: "On hand",
        points: [
          { x: "W3", y: 10 },
          { x: "W1", y: 4 },
        ],
      },
      {
        name: "Available",
        points: [
          { x: "W2", y: 8 },
          { x: "W1", y: 3 },
        ],
      },
    ]);
    expect(rows.map((row) => row.x)).toEqual(["W1", "W2", "W3"]);
    expect(rows[0]).toEqual({ x: "W1", "On hand": 4, Available: 3 });
    expect(rows[1]).toEqual({ x: "W2", "On hand": 0, Available: 8 });
  });
});
