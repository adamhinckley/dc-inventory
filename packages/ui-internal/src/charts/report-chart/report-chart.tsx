import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_SERIES_COLORS } from "./chart-tokens";
import { formatChartY, toWideRows } from "./report-chart-data";
import type { ReportChartProps } from "./report-chart-types";

function seriesColor(index: number): string {
  return (
    CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length] ??
    "var(--color-chart-01)"
  );
}

/**
 * Staff report chart for OpenAPI `x-chart` series (Recharts stub).
 *
 * When to use: internal report pages that already have an Orval report hook
 * and `x-chart` meta. Pass series from that hook — do not invent aggregates.
 *
 * When not to use: wholesale merchandising, ops licensing, or a new chart
 * type folder. Ship another type only when a ticket adds that folder.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * import { ReportChart } from "@dc-inventory/ui-internal";
 *
 * <ReportChart
 *   meta={{ type: "line", xLabel: "Week", yUnit: "quantity" }}
 *   series={[{ name: "Available", points: [{ x: "W1", y: 48 }] }]}
 * />
 * ```
 */
export function ReportChart({ meta, series }: ReportChartProps) {
  if (meta.type === "kpi") {
    const first = series[0];
    const last = first?.points.at(-1);
    return (
      <div className="rounded-sm border border-border-subtle bg-layer-01 p-4">
        <p className="text-sm text-secondary">{first?.name ?? "KPI"}</p>
        <p className="text-2xl tabular-nums text-primary">
          {last ? formatChartY(last.y, meta.yUnit) : "—"}
        </p>
        {meta.yUnit ? (
          <p className="text-sm text-helper">{meta.yUnit}</p>
        ) : null}
      </div>
    );
  }

  const data = toWideRows(series);

  if (meta.type === "pie") {
    const pieData =
      series[0]?.points.map((point) => ({ name: point.x, value: point.y })) ?? [];
    return (
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" label>
              {pieData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={seriesColor(index)}
                  name={entry.name}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const ChartImpl = meta.type === "bar" ? BarChart : LineChart;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ChartImpl data={data}>
          <CartesianGrid stroke="var(--color-border-subtle)" />
          <XAxis
            dataKey="x"
            label={meta.xLabel ? { value: meta.xLabel, position: "insideBottom" } : undefined}
            stroke="var(--color-text-secondary)"
          />
          <YAxis
            stroke="var(--color-text-secondary)"
            tickFormatter={(value: number) => formatChartY(value, meta.yUnit)}
          />
          <Tooltip />
          <Legend />
          {series.map((item, index) =>
            meta.type === "bar" ? (
              <Bar
                key={item.name}
                dataKey={item.name}
                fill={seriesColor(index)}
              />
            ) : (
              <Line
                key={item.name}
                type="monotone"
                dataKey={item.name}
                stroke={seriesColor(index)}
                dot={false}
              />
            ),
          )}
        </ChartImpl>
      </ResponsiveContainer>
    </div>
  );
}
