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

/** OpenAPI `x-chart` on report operations. */
export type ChartMeta = {
  type: "line" | "bar" | "pie" | "kpi";
  xLabel?: string;
  yUnit?: "cents" | "count" | "quantity";
};

export type ChartPoint = {
  x: string;
  y: number;
};

export type ChartSeries = {
  name: string;
  points: readonly ChartPoint[];
};

export type ReportChartProps = {
  meta: ChartMeta;
  series: readonly ChartSeries[];
};

function seriesColor(index: number): string {
  return (
    CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length] ??
    "var(--color-chart-01)"
  );
}

function toWideRows(series: readonly ChartSeries[]): Record<string, string | number>[] {
  const xs = new Set<string>();
  for (const item of series) {
    for (const point of item.points) {
      xs.add(point.x);
    }
  }
  return [...xs].map((x) => {
    const row: Record<string, string | number> = { x };
    for (const item of series) {
      const point = item.points.find((entry) => entry.x === x);
      row[item.name] = point?.y ?? 0;
    }
    return row;
  });
}

function yTick(value: number, unit: ChartMeta["yUnit"]): string {
  if (unit === "cents") {
    return String(value);
  }
  return String(value);
}

export function ReportChart({ meta, series }: ReportChartProps) {
  if (meta.type === "kpi") {
    const first = series[0];
    const last = first?.points.at(-1);
    return (
      <div className="rounded-sm border border-border-subtle bg-layer-01 p-4">
        <p className="text-sm text-secondary">{first?.name ?? "KPI"}</p>
        <p className="text-2xl tabular-nums text-primary">
          {last ? yTick(last.y, meta.yUnit) : "—"}
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
            tickFormatter={(value: number) => yTick(value, meta.yUnit)}
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
