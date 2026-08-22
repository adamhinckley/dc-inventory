import { formatMoneyMinorUnits } from "@dc-inventory/ui";
import type { ChartMeta, ChartSeries } from "./report-chart-types";

export function toWideRows(
  series: readonly ChartSeries[],
): Record<string, string | number>[] {
  const xs = new Set<string>();
  for (const item of series) {
    for (const point of item.points) {
      xs.add(point.x);
    }
  }
  return [...xs]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((x) => {
      const row: Record<string, string | number> = { x };
      for (const item of series) {
        const point = item.points.find((entry) => entry.x === x);
        row[item.name] = point?.y ?? 0;
      }
      return row;
    });
}

/** Display-only tick/KPI label. Money stays integer cents until this edge. */
export function formatChartY(value: number, unit: ChartMeta["yUnit"]): string {
  if (unit === "cents") {
    return formatMoneyMinorUnits(value, "USD");
  }
  return String(value);
}
